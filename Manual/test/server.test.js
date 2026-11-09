const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const { createEmptyState } = require('../public/js/common.js');

const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = `http://127.0.0.1:${PORT}`;

function startServer(stateFile) {
    const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
        env: { ...process.env, PORT: String(PORT), STATE_FILE: stateFile },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    return new Promise((resolve, reject) => {
        proc.stdout.on('data', d => { if (String(d).includes('prêt')) resolve(proc); });
        proc.on('exit', code => reject(new Error(`serveur arrêté (code ${code})`)));
    });
}

function stopServer(proc) {
    return new Promise(resolve => { proc.removeAllListeners('exit'); proc.on('exit', resolve); proc.kill('SIGTERM'); });
}

function connect() {
    const socket = io(URL, { transports: ['websocket'] });
    return new Promise(resolve => socket.on('init', data => resolve({ socket, data })));
}

test('le serveur valide, diffuse et sauvegarde l\'état', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nuz-')), 'state.json');
    let proc = await startServer(stateFile);
    try {
        const { socket: dashboard, data } = await connect();
        assert.strictEqual(data.dict.length, 1025);
        const { socket: overlay } = await connect();
        const received = [];
        overlay.on('state_updated', s => received.push(s));

        dashboard.emit('update_state', { team: 'invalide' });
        const state = createEmptyState();
        state.team[0] = { nickname: 'Pika', frSpecies: 'Pikachu', enSpecies: 'Pikachu' };
        dashboard.emit('update_state', state);
        dashboard.emit('update_state', state);
        await new Promise(r => setTimeout(r, 300));

        assert.strictEqual(received.length, 1);
        assert.strictEqual(received[0].team[0].nickname, 'Pika');
        dashboard.close();
        overlay.close();
    } finally {
        await stopServer(proc);
    }

    assert.ok(fs.existsSync(stateFile));
    proc = await startServer(stateFile);
    try {
        const { socket, data } = await connect();
        assert.strictEqual(data.state.team[0].nickname, 'Pika');
        socket.close();
    } finally {
        await stopServer(proc);
    }
});

test('les sprites locaux sont servis depuis le dossier partagé', async () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nuz-')), 'state.json');
    const proc = await startServer(stateFile);
    try {
        const ok = await fetch(`${URL}/sprites/mr-mime.png`);
        assert.strictEqual(ok.status, 200);
        const css = await fetch(`${URL}/css/tailwind.css`);
        assert.strictEqual(css.status, 200);
    } finally {
        await stopServer(proc);
    }
});
