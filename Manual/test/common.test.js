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
