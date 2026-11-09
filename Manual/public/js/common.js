// Utilitaires partagés entre le serveur (Node.js), le dashboard et les overlays (navigateur)
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this, function () {
    const DEFAULT_CONFIG = Object.freeze({
        cemeterySpeed: 18,
        cemeteryPause: 45000,
        cemeteryStartText: "Ils nous ont quittés :",
        cemeteryEndText: "— Reposez en paix.",
        boxSlideDuration: 0.5,
        boxCycleDuration: 5,  // Temps d'affichage par boîte dans l'overlay (en secondes)
        autoSyncInterval: 0   // Temps de rafraîchissement d'envoi automatique d'OBS (0 = manuel)
    });

    function createEmptyState() {
        return {
            team: Array(6).fill(null),
            boxes: [Array(30).fill(null)],
            currentBoxIndex: 0,
            cemetery: [],
            config: { ...DEFAULT_CONFIG }
        };
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Nom de fichier des sprites locaux et de Pokémon Database (ex : "Mr. Mime" -> "mr-mime", "Nidoran♀" -> "nidoran-f")
    function getSpriteString(name) {
        if (!name) return '';
        return String(name).toLowerCase()
            .replace(/♀/g, '-f').replace(/♂/g, '-m')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[.'’:]/g, '')
            .trim().replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    // Identifiant Pokémon Showdown (ex : "Mr. Mime" -> "mrmime", "Nidoran♀" -> "nidoranf")
    function getShowdownSlug(name) {
        return getSpriteString(name).replace(/-/g, '');
    }

    function getShowdownSpriteUrl(name, isShiny) {
        return `https://play.pokemonshowdown.com/sprites/${isShiny ? 'gen5ani-shiny' : 'gen5ani'}/${getShowdownSlug(name)}.gif`;
    }

    function getFallbackSpriteUrl(name) {
        return `https://img.pokemondb.net/sprites/home/normal/${getSpriteString(name)}.png`;
    }

    return { DEFAULT_CONFIG, createEmptyState, escapeHtml, getSpriteString, getShowdownSlug, getShowdownSpriteUrl, getFallbackSpriteUrl };
});
