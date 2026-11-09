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

// Découpe un CSV en lignes/colonnes en gérant les champs entre guillemets (virgules et retours à la ligne inclus)
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else field += c;
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field); field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row);
            row = []; field = '';
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

// Chargement du dictionnaire de traduction CSV
let pokemonDict = [];
try {
    const csvPath = path.join(__dirname, 'data pokemon - Pokemon Dico.csv');
    if (fs.existsSync(csvPath)) {
        const csv = fs.readFileSync(csvPath, 'utf8');
        pokemonDict = parseCsv(csv).slice(1) // Ignore la ligne d'en-tête
            .filter(parts => parts.length >= 3 && parts[1].trim())
            .map(parts => ({
                id: parts[0].trim(),
                en: parts[1].replace(/\s+/g, ' ').trim(),
                fr: parts[2].replace(/\s+/g, ' ').trim()
            }));
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

function isValidState(state) {
    return !!state && typeof state === 'object'
        && Array.isArray(state.team) && state.team.length <= 6
        && Array.isArray(state.boxes) && state.boxes.length > 0
        && state.boxes.every(box => Array.isArray(box) && box.length <= 30)
        && Array.isArray(state.cemetery)
        && Number.isInteger(state.currentBoxIndex)
        && state.currentBoxIndex >= 0 && state.currentBoxIndex < state.boxes.length
        && (state.config === undefined || (typeof state.config === 'object' && state.config !== null));
}

// Gestion des WebSockets en temps réel
io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté au serveur.');

    // Envoi des données courantes au nouveau client connecté
    socket.emit('init', { state: appState, dict: pokemonDict });

    // Réception d'une mise à jour depuis le Dashboard
    socket.on('update_state', (newState) => {
        if (!isValidState(newState)) {
            console.warn('Mise à jour ignorée : état reçu invalide.');
            return;
        }
        // Évite de rediffuser un état identique (ex : synchronisation automatique)
        if (JSON.stringify(newState) === JSON.stringify(appState)) return;

        appState = newState;
        // Diffusion immédiate à l'ensemble des overlays connectés
        io.emit('state_updated', appState);
        console.log(`Données d'équipe, de PC Box (Index Actuel Dashboard: ${appState.currentBoxIndex}) et du cimetière synchronisées.`);
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté.');
    });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
    console.log('===================================================');
    console.log(`🚀 Serveur Poke-Stream Manuel prêt et fonctionnel !`);
    console.log(`🌐 Tableau de bord : http://localhost:${PORT}/dashboard.html`);
    console.log(`📺 Overlay Équipe  : http://localhost:${PORT}/team.html`);
    console.log(`📺 Overlay Cimetière: http://localhost:${PORT}/cemetery.html`);
    console.log(`📺 Overlay Boîte PC: http://localhost:${PORT}/box.html`);
    console.log('===================================================');
});