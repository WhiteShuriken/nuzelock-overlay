const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseCsv, parsePokemonDict, loadPokemonDict } = require('../lib/csv');

test('parseCsv gère les champs entre guillemets sur plusieurs lignes', () => {
    const rows = parseCsv('a,b\r\n1,"x, y"\n2,"multi\nligne"\n');
    assert.deepStrictEqual(rows, [['a', 'b'], ['1', 'x, y'], ['2', 'multi\nligne']]);
});

test('parsePokemonDict normalise les espaces et ignore les lignes vides', () => {
    const dict = parsePokemonDict('#,English,Français\n1,Bulbasaur,Bulbizarre\n916,"Oinkologne\nMale",No-Data\n\n');
    assert.deepStrictEqual(dict, [
        { id: '1', en: 'Bulbasaur', fr: 'Bulbizarre' },
        { id: '916', en: 'Oinkologne Male', fr: 'No-Data' }
    ]);
});

test('le dictionnaire du dépôt contient 1025 Pokémon', () => {
    const dict = loadPokemonDict(path.join(__dirname, '..', 'data pokemon - Pokemon Dico.csv'));
    assert.strictEqual(dict.length, 1025);
    assert.deepStrictEqual(dict.find(p => p.id === '122'), { id: '122', en: 'Mr. Mime', fr: 'M. Mime' });
});
