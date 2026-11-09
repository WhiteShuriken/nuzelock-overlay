const fs = require('fs');

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

function parsePokemonDict(text) {
    return parseCsv(text).slice(1) // Ignore la ligne d'en-tête
        .filter(parts => parts.length >= 3 && parts[1].trim())
        .map(parts => ({
            id: parts[0].trim(),
            en: parts[1].replace(/\s+/g, ' ').trim(),
            fr: parts[2].replace(/\s+/g, ' ').trim()
        }));
}

function loadPokemonDict(csvPath) {
    return parsePokemonDict(fs.readFileSync(csvPath, 'utf8'));
}

module.exports = { parseCsv, parsePokemonDict, loadPokemonDict };
