const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Distribution des fichiers statiques du dossier public (dashboard, team, cemetery, box)
app.use(express.static(path.join(__dirname, 'public'))); 

// Distribution des sprites locaux depuis le sous-dossier Cemetery/CemeteryOverlaySprite
app.use('/sprites', express.static(path.join(__dirname, 'Cemetery', 'CemeteryOverlaySprite'))); 

// Chargement du dictionnaire de traduction CSV
let pokemonDict = [];
try {
    const csvPath = path.join(__dirname, 'data pokemon - Pokemon Dico.csv');
    if (fs.existsSync(csvPath)) {
        const csv = fs.readFileSync(csvPath, 'utf8');
        const lines = csv.split('\n').slice(1); // Ignore la ligne d'en-tête
        pokemonDict = lines.map(line => {
            const parts = line.split(',');
            if (parts.length >= 3) {
                return { 
                    id: parts[0].trim(), 
                    en: parts[1].trim(), 
                    fr: parts[2].trim().replace('\r', '') 
                };
            }
            return null;
        }).filter(p => p !== null);
        console.log(`Dictionnaire CSV chargé avec succès : ${pokemonDict.length} Pokémon répertoriés.`);
    } else {
        console.warn(`ATTENTION: Fichier CSV manquant au chemin : ${csvPath}`);
    }
} catch (e) {
    console.error("Erreur critique lors de la lecture du dictionnaire CSV :", e);
}

// État initial de l'application (sauvegardé en mémoire vive du serveur)
let appState = {
    team: Array(6).fill(null),
    cemetery: [],
    boxes: [Array(30).fill(null)], // Contient au moins une boîte de 30 slots par défaut
    currentBoxIndex: 0, // Index de la boîte active affichée et éditée sur le dashboard
    config: { // Configurations personnalisables par l'utilisateur
        cemeterySpeed: 18,
        cemeteryPause: 45000,
        cemeteryStartText: "Ils nous ont quittés :",
        cemeteryEndText: "— Reposez en paix.",
        boxSlideDuration: 0.5,
        boxCycleDuration: 5, // Temps d'affichage par boîte dans l'overlay (en secondes)
        autoSyncInterval: 0  // Temps de rafraîchissement d'envoi automatique d'OBS (0 = manuel)
    }
};

// Gestion des WebSockets en temps réel
io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté au serveur.');

    // Envoi des données courantes au nouveau client connecté
    socket.emit('init', { state: appState, dict: pokemonDict });

    // Réception d'une mise à jour depuis le Dashboard
    socket.on('update_state', (newState) => {
        appState = newState;
        // Diffusion immédiate à l'ensemble des overlays connectés
        io.emit('state_updated', appState);
        console.log(`Données d'équipe, de PC Box (Index Actuel Dashboard: ${appState.currentBoxIndex}) et du cimetière synchronisées.`);
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté.');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log('===================================================');
    console.log(`🚀 Serveur Poke-Stream Manuel prêt et fonctionnel !`);
    console.log(`🌐 Tableau de bord : http://localhost:${PORT}/dashboard.html`);
    console.log(`📺 Overlay Équipe  : http://localhost:${PORT}/team.html`);
    console.log(`📺 Overlay Cimetière: http://localhost:${PORT}/cemetery.html`);
    console.log(`📺 Overlay Boîte PC: http://localhost:${PORT}/box.html`);
    console.log('===================================================');
});