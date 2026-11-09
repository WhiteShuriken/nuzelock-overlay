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
        boxCycleDuration: 5   // Temps d'affichage par boîte dans l'overlay (en secondes)
    });

    function createEmptyState() {
        return {
            team: Array(6).fill(null),
            boxes: [Array(30).fill(null)],
            currentBoxIndex: 0,
            cemetery: [],
            counters: { badges: 0, attempts: 1 },
            lastDeath: null,
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

    function getLocalSpriteUrl(name) {
        return `/sprites/${getSpriteString(name)}.png`;
    }

    // Ordre de chargement des sprites : Showdown animé (sauf mode "local"), puis sprite local (hors-ligne), puis Pokémon Database
    function getSpriteCandidates(pokemon, mode) {
        const name = pokemon.enSpecies || pokemon.frSpecies || pokemon.nickname;
        const urls = [getLocalSpriteUrl(name), getFallbackSpriteUrl(name)];
        if (mode !== 'local') urls.unshift(getShowdownSpriteUrl(name, pokemon.isShiny));
        return urls;
    }

    // <img> qui essaie chaque source tour à tour (voir nextSpriteFallback)
    function spriteImgHtml(pokemon, mode, attrs = '') {
        const [first, ...rest] = getSpriteCandidates(pokemon, mode);
        return `<img src="${escapeHtml(first)}" data-fallbacks="${escapeHtml(rest.join('|'))}" onerror="nextSpriteFallback(this)" ${attrs}>`;
    }

    function nextSpriteFallback(img) {
        const list = (img.dataset.fallbacks || '').split('|').filter(Boolean);
        if (list.length === 0) {
            img.onerror = null;
            img.style.visibility = 'hidden';
            return;
        }
        img.dataset.fallbacks = list.slice(1).join('|');
        img.src = list[0];
    }

    // Fiche Pokémon normalisée pour l'équipe ("team") ou le PC ("box")
    function makePokemon(fields, dest) {
        const enSpecies = fields.enSpecies || fields.frSpecies || fields.nickname || '';
        const level = fields.level === undefined || fields.level === null ? '' : String(fields.level).trim();
        return {
            nickname: String(fields.nickname || fields.frSpecies || '').trim(),
            frSpecies: String(fields.frSpecies || fields.nickname || '').trim(),
            enSpecies,
            gender: ['M', 'F'].includes(fields.gender) ? fields.gender : 'None',
            isShiny: Boolean(fields.isShiny),
            level: level || null,
            route: String(fields.route || '').trim() || null,
            sprite: dest === 'team' ? getShowdownSpriteUrl(enSpecies, fields.isShiny) : getLocalSpriteUrl(enSpecies),
            fallback: getFallbackSpriteUrl(enSpecies)
        };
    }

    // Premier emplacement libre : équipe, puis boîte affichée, puis les autres boîtes
    function findFreeSlot(state) {
        const teamIndex = state.team.findIndex(p => !p);
        if (teamIndex !== -1) return { type: 'team', index: teamIndex };
        const order = [state.currentBoxIndex, ...state.boxes.map((_, i) => i).filter(i => i !== state.currentBoxIndex)];
        for (const boxIndex of order) {
            const index = state.boxes[boxIndex].findIndex(p => !p);
            if (index !== -1) return { type: 'box', boxIndex, index };
        }
        return null;
    }

    function placePokemon(state, fields) {
        const slot = findFreeSlot(state);
        if (!slot) return null;
        if (slot.type === 'team') state.team[slot.index] = makePokemon(fields, 'team');
        else state.boxes[slot.boxIndex][slot.index] = makePokemon(fields, 'box');
        return slot;
    }

    // Envoie un Pokémon au cimetière. source : { type: 'team' | 'pc' | 'manual', index, boxIndex, data }
    function recordDeath(state, source, details = {}) {
        let pokemon = null;
        if (source.type === 'team') {
            pokemon = state.team[source.index];
            state.team[source.index] = null;
        } else if (source.type === 'pc') {
            const boxIndex = source.boxIndex ?? state.currentBoxIndex;
            pokemon = state.boxes[boxIndex][source.index];
            state.boxes[boxIndex][source.index] = null;
        } else if (source.type === 'manual') {
            pokemon = source.data;
        }
        if (!pokemon) return null;

        const now = details.now ?? Date.now();
        const level = String(details.level ?? '').trim() || pokemon.level || null;
        const entry = {
            nickname: pokemon.nickname,
            frSpecies: pokemon.frSpecies,
            enSpecies: pokemon.enSpecies,
            gender: pokemon.gender || 'None',
            isShiny: Boolean(pokemon.isShiny),
            sprite: getLocalSpriteUrl(pokemon.enSpecies),
            level,
            route: pokemon.route || null,
            deathCause: String(details.cause ?? '').trim() || null,
            diedAt: new Date(now).toISOString()
        };
        state.cemetery.push(entry);
        // Identifiant croissant : l'overlay d'alerte ne rejoue pas une ancienne mort (ex : après un "Annuler")
        const previousId = state.lastDeath ? state.lastDeath.id : 0;
        state.lastDeath = { ...entry, id: Math.max(now, previousId + 1) };
        return entry;
    }

    function getCounters(state) {
        const alive = [...state.team, ...state.boxes.flat()].filter(Boolean).length;
        const counters = state.counters || {};
        return {
            deaths: state.cemetery.length,
            captures: alive + state.cemetery.length,
            badges: Number(counters.badges) || 0,
            attempts: Number(counters.attempts) || 1
        };
    }

    // Options des overlays passées dans l'URL OBS (ex : team.html?layout=vertical&scale=1.5&level=0&sprites=local)
    function parseOverlayParams(search) {
        const params = new URLSearchParams(search || '');
        const scale = parseFloat(params.get('scale'));
        const duration = parseFloat(params.get('duration'));
        const flag = (name, def) => params.has(name) ? !['0', 'false', 'non', 'no'].includes(params.get(name).toLowerCase()) : def;
        return {
            scale: scale > 0 && scale <= 5 ? scale : 1,
            layout: params.get('layout') === 'vertical' ? 'vertical' : 'horizontal',
            sprites: params.get('sprites') === 'local' ? 'local' : 'showdown',
            showLevel: flag('level', true),
            showNickname: flag('nickname', true),
            showDetails: flag('details', true),
            duration: duration > 0 ? duration : 8,
            show: (params.get('show') || 'deaths,captures,badges,attempts').split(',').map(x => x.trim()).filter(Boolean)
        };
    }

    return {
        DEFAULT_CONFIG, createEmptyState, escapeHtml, getSpriteString, getShowdownSlug, getShowdownSpriteUrl,
        getFallbackSpriteUrl, getLocalSpriteUrl, getSpriteCandidates, spriteImgHtml, nextSpriteFallback, makePokemon, findFreeSlot, placePokemon,
        recordDeath, getCounters, parseOverlayParams
    };
});
