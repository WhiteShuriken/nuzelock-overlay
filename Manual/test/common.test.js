const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { escapeHtml, getSpriteString, getShowdownSlug, getShowdownSpriteUrl, createEmptyState, DEFAULT_CONFIG } = require('../public/js/common.js');
const { loadPokemonDict } = require('../lib/csv');

test('getSpriteString suit le nommage des fichiers locaux', () => {
    assert.strictEqual(getSpriteString('Mr. Mime'), 'mr-mime');
    assert.strictEqual(getSpriteString('Nidoran♀'), 'nidoran-f');
    assert.strictEqual(getSpriteString('Nidoran♂'), 'nidoran-m');
    assert.strictEqual(getSpriteString('Ho-oh'), 'ho-oh');
    assert.strictEqual(getSpriteString("Farfetch'd"), 'farfetchd');
    assert.strictEqual(getSpriteString('Flabébé'), 'flabebe');
    assert.strictEqual(getSpriteString('Type: Null'), 'type-null');
    assert.strictEqual(getSpriteString(''), '');
});

test('getShowdownSlug suit les identifiants Showdown', () => {
    assert.strictEqual(getShowdownSlug('Mr. Mime'), 'mrmime');
    assert.strictEqual(getShowdownSlug('Nidoran♀'), 'nidoranf');
    assert.strictEqual(getShowdownSlug('Porygon-Z'), 'porygonz');
    assert.strictEqual(getShowdownSpriteUrl('Pikachu', true), 'https://play.pokemonshowdown.com/sprites/gen5ani-shiny/pikachu.gif');
});

test('escapeHtml neutralise le HTML', () => {
    assert.strictEqual(escapeHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
    assert.strictEqual(escapeHtml(null), '');
});

test('createEmptyState renvoie un nouvel état à chaque appel', () => {
    const a = createEmptyState();
    a.team[0] = {};
    a.config.cemeterySpeed = 1;
    const b = createEmptyState();
    assert.strictEqual(b.team[0], null);
    assert.strictEqual(b.config.cemeterySpeed, DEFAULT_CONFIG.cemeterySpeed);
    assert.strictEqual(b.boxes[0].length, 30);
});

test('chaque Pokémon de la 1re à la 7e génération a un sprite local', () => {
    const dict = loadPokemonDict(path.join(__dirname, '..', 'data pokemon - Pokemon Dico.csv'));
    const spritesDir = path.join(__dirname, '..', '..', 'Cemetery', 'CemeteryOverlaySprite');
    const missing = dict
        .filter(p => Number(p.id) <= 809)
        .filter(p => !fs.existsSync(path.join(spritesDir, `${getSpriteString(p.en)}.png`)))
        .map(p => p.en);
    assert.deepStrictEqual(missing, []);
});

const { makePokemon, placePokemon, recordDeath, getCounters, parseOverlayParams, getSpriteCandidates } = require('../public/js/common.js');

test('placePokemon remplit l\'équipe puis le PC', () => {
    const state = createEmptyState();
    state.boxes.push(Array(30).fill(null));
    state.currentBoxIndex = 1;
    for (let i = 0; i < 6; i++) assert.deepStrictEqual(placePokemon(state, { frSpecies: 'Pikachu', enSpecies: 'Pikachu' }), { type: 'team', index: i });
    const slot = placePokemon(state, { frSpecies: 'M. Mime', enSpecies: 'Mr. Mime', level: 12, route: 'Route 2' });
    assert.deepStrictEqual(slot, { type: 'box', boxIndex: 1, index: 0 });
    assert.strictEqual(state.boxes[1][0].sprite, '/sprites/mr-mime.png');
    assert.strictEqual(state.boxes[1][0].level, '12');
    assert.strictEqual(state.boxes[1][0].route, 'Route 2');
    assert.strictEqual(state.team[0].sprite, 'https://play.pokemonshowdown.com/sprites/gen5ani/pikachu.gif');
    state.boxes = state.boxes.map(() => Array(30).fill({}));
    assert.strictEqual(placePokemon(state, { frSpecies: 'Abra' }), null);
});

test('recordDeath alimente le cimetière, lastDeath et les compteurs', () => {
    const state = createEmptyState();
    state.team[2] = makePokemon({ nickname: 'Nido', frSpecies: 'Nidoran♀', enSpecies: 'Nidoran♀', gender: 'F', isShiny: true, level: 20, route: 'Route 3' }, 'team');
    const entry = recordDeath(state, { type: 'team', index: 2 }, { cause: 'Critique', now: 1000 });
    assert.strictEqual(state.team[2], null);
    assert.strictEqual(entry.level, '20');
    assert.strictEqual(entry.route, 'Route 3');
    assert.strictEqual(entry.sprite, '/sprites/nidoran-f.png');
    assert.strictEqual(entry.diedAt, new Date(1000).toISOString());
    assert.strictEqual(state.lastDeath.id, 1000);
    recordDeath(state, { type: 'manual', data: { nickname: 'X', frSpecies: 'Abra', enSpecies: 'Abra' } }, { level: '5', now: 500 });
    assert.strictEqual(state.lastDeath.id, 1001);
    assert.strictEqual(recordDeath(state, { type: 'team', index: 0 }), null);
    assert.deepStrictEqual(getCounters(state), { deaths: 2, captures: 2, badges: 0, attempts: 1 });
});

test('parseOverlayParams lit les options OBS', () => {
    assert.deepStrictEqual(parseOverlayParams('?layout=vertical&scale=1.5&level=0&sprites=local&show=deaths,badges'), {
        scale: 1.5, layout: 'vertical', sprites: 'local', showLevel: false, showNickname: true, showDetails: true, duration: 8, show: ['deaths', 'badges']
    });
    const def = parseOverlayParams('');
    assert.strictEqual(def.scale, 1);
    assert.strictEqual(def.layout, 'horizontal');
    assert.strictEqual(parseOverlayParams('?scale=99').scale, 1);
});

test('getSpriteCandidates passe par le sprite local avant internet', () => {
    const p = { enSpecies: 'Mr. Mime', isShiny: true };
    assert.deepStrictEqual(getSpriteCandidates(p), [
        'https://play.pokemonshowdown.com/sprites/gen5ani-shiny/mrmime.gif', '/sprites/mr-mime.png', 'https://img.pokemondb.net/sprites/home/normal/mr-mime.png'
    ]);
    assert.strictEqual(getSpriteCandidates(p, 'local')[0], '/sprites/mr-mime.png');
});
