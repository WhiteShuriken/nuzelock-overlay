const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPokemonDict } = require('./lib/csv');
const { isValidState, loadState, createStateSaver } = require('./lib/state');

const PORT = Number(process.env.PORT) || 3000;
// 127.0.0.1 par défaut : seul ce PC peut piloter l'overlay. HOST=0.0.0.0 pour l'ouvrir au réseau local (OBS sur un autre PC).
const HOST = process.env.HOST || '127.0.0.1';
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'state.json');
const SPRITES_DIR = path.join(__dirname, '..', 'Cemetery', 'CemeteryOverlaySprite');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Distribution des fichiers statiques du dossier public (dashboard, team, cemetery, box)
app.use(express.static(path.join(__dirname, 'public')));

// Sprites locaux partagés avec l'overlay autonome du cimetière
app.use('/sprites', express.static(SPRITES_DIR));

// Chargement du dictionnaire de traduction CSV
let pokemonDict = [];
const csvPath = path.join(__dirname, 'data pokemon - Pokemon Dico.csv');
try {
    if (fs.existsSync(csvPath)) {
        pokemonDict = loadPokemonDict(csvPath);
        console.log(`Dictionnaire CSV chargé avec succès : ${pokemonDict.length} Pokémon répertoriés.`);
    } else {
        console.warn(`ATTENTION: Fichier CSV manquant au chemin : ${csvPath}`);
    }
} catch (e) {
    console.error("Erreur critique lors de la lecture du dictionnaire CSV :", e);
}

// Adresses à ouvrir depuis un téléphone (seulement si le serveur est ouvert au réseau local)
function getMobileUrls() {
    if (HOST !== '0.0.0.0' && HOST !== '::') return [];
    return Object.values(os.networkInterfaces()).flat()
        .filter(i => i && i.family === 'IPv4' && !i.internal)
        .map(i => `http://${i.address}:${PORT}/mobile.html`);
}

// État de l'application, restauré depuis le disque au démarrage
let appState = loadState(STATE_FILE);
const stateSaver = createStateSaver(STATE_FILE);

// Gestion des WebSockets en temps réel
io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté au serveur.');

    // Envoi des données courantes au nouveau client connecté
    socket.emit('init', { state: appState, dict: pokemonDict, info: { mobileUrls: getMobileUrls() } });

    // Réception d'une mise à jour depuis le Dashboard
    socket.on('update_state', (newState) => {
        if (!isValidState(newState)) {
            console.warn('Mise à jour ignorée : état reçu invalide.');
            return;
        }
        // Évite de rediffuser un état identique (ex : synchronisation automatique)
        if (JSON.stringify(newState) === JSON.stringify(appState)) return;

        appState = newState;
        stateSaver.save(appState);
        // Diffusion immédiate à l'ensemble des overlays connectés
        io.emit('state_updated', appState);
        console.log(`Données d'équipe, de PC Box (Index Actuel Dashboard: ${appState.currentBoxIndex}) et du cimetière synchronisées.`);
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté.');
    });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        stateSaver.flush();
        process.exit(0);
    });
}

server.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log('===================================================');
    console.log(`🚀 Serveur Poke-Stream Manuel prêt et fonctionnel !`);
    console.log(`🌐 Tableau de bord : http://${displayHost}:${PORT}/dashboard.html`);
    console.log(`📺 Overlay Équipe  : http://${displayHost}:${PORT}/team.html`);
    console.log(`📺 Overlay Cimetière: http://${displayHost}:${PORT}/cemetery.html`);
    console.log(`📺 Overlay Boîte PC: http://${displayHost}:${PORT}/box.html`);
    console.log(`📺 Alerte de mort  : http://${displayHost}:${PORT}/alert.html`);
    console.log(`📺 Compteurs       : http://${displayHost}:${PORT}/counters.html`);
    console.log(`📱 Mobile          : http://${displayHost}:${PORT}/mobile.html`);
    for (const url of getMobileUrls()) console.log(`📱 Depuis le réseau : ${url}`);
    console.log(`💾 Sauvegarde      : ${STATE_FILE}`);
    console.log('===================================================');
});
