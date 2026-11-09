const fs = require('fs');
const { createEmptyState } = require('../public/js/common.js');

function isValidState(state) {
    return !!state && typeof state === 'object'
        && Array.isArray(state.team) && state.team.length <= 6
        && Array.isArray(state.boxes) && state.boxes.length > 0
        && state.boxes.every(box => Array.isArray(box) && box.length <= 30)
        && Array.isArray(state.cemetery)
        && Number.isInteger(state.currentBoxIndex)
        && state.currentBoxIndex >= 0 && state.currentBoxIndex < state.boxes.length
        && (state.config === undefined || (typeof state.config === 'object' && state.config !== null))
        && (state.counters === undefined || (typeof state.counters === 'object' && state.counters !== null))
        && (state.lastDeath === undefined || state.lastDeath === null || typeof state.lastDeath === 'object');
}

function loadState(filePath) {
    try {
        if (!fs.existsSync(filePath)) return createEmptyState();
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (isValidState(parsed)) return parsed;
        console.warn(`Sauvegarde ignorée (format invalide) : ${filePath}`);
    } catch (e) {
        console.error(`Impossible de lire la sauvegarde ${filePath} :`, e.message);
    }
    return createEmptyState();
}

// Écriture différée et atomique (fichier temporaire puis renommage) pour ne pas écrire à chaque frappe
function createStateSaver(filePath, delayMs = 1000) {
    let timer = null;
    let pending = null;

    function flush() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!pending) return;
        const tmpPath = `${filePath}.tmp`;
        try {
            fs.writeFileSync(tmpPath, JSON.stringify(pending, null, 2));
            fs.renameSync(tmpPath, filePath);
        } catch (e) {
            console.error(`Impossible d'écrire la sauvegarde ${filePath} :`, e.message);
        }
        pending = null;
    }

    function save(state) {
        pending = state;
        if (!timer) timer = setTimeout(flush, delayMs);
    }

    return { save, flush };
}

module.exports = { isValidState, loadState, createStateSaver };
