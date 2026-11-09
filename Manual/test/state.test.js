const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isValidState, loadState, createStateSaver } = require('../lib/state');
const { createEmptyState } = require('../public/js/common.js');

test('isValidState accepte un état vide et refuse les formes invalides', () => {
    assert.ok(isValidState(createEmptyState()));
    assert.ok(!isValidState(null));
    assert.ok(!isValidState({ team: 'x' }));
    assert.ok(!isValidState({ ...createEmptyState(), team: Array(7).fill(null) }));
    assert.ok(!isValidState({ ...createEmptyState(), boxes: [] }));
    assert.ok(!isValidState({ ...createEmptyState(), currentBoxIndex: 3 }));
    assert.ok(!isValidState({ ...createEmptyState(), config: null }));
});

test('loadState renvoie un état vide si le fichier est absent ou invalide', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuz-'));
    assert.deepStrictEqual(loadState(path.join(dir, 'absent.json')), createEmptyState());
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{"team": 1}');
    assert.deepStrictEqual(loadState(bad), createEmptyState());
});

test('createStateSaver écrit la sauvegarde au flush', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuz-'));
    const file = path.join(dir, 'state.json');
    const saver = createStateSaver(file, 60000);
    const state = createEmptyState();
    state.cemetery.push({ nickname: 'Boxy' });
    saver.save(state);
    assert.ok(!fs.existsSync(file));
    saver.flush();
    assert.deepStrictEqual(loadState(file), state);
});
