// Télécommande compacte pour téléphone : équipe, capture rapide, morts et compteurs
const socket = io();
let pokemonDict = [];
let state = createEmptyState();
let pendingDeathIndex = null;
const undoStack = [];

function getEnName(frName) {
    const found = pokemonDict.find(p => p.fr.toLowerCase() === String(frName || '').toLowerCase());
    return found ? found.en : frName;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `fixed bottom-4 inset-x-4 z-50 px-4 py-3 rounded-xl text-sm font-bold text-center shadow-2xl ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

function commit() {
    socket.emit('update_state', state);
    render();
}

function remember() {
    undoStack.push(JSON.parse(JSON.stringify(state)));
    if (undoStack.length > 20) undoStack.shift();
    document.getElementById('undo-btn').classList.remove('hidden');
}

function undoLastAction() {
    if (undoStack.length === 0) return;
    state = undoStack.pop();
    document.getElementById('undo-btn').classList.toggle('hidden', undoStack.length === 0);
    commit();
    showToast('⏪ Action annulée');
}

function renderCounters() {
    const c = getCounters(state);
    const card = (label, value, key, color) => `
        <div class="bg-gray-800 rounded-xl px-3 py-2 flex items-center justify-between">
            <div><div class="text-[11px] text-gray-400 font-bold">${label}</div><div class="text-xl font-black ${color}">${value}</div></div>
            ${key ? `<div class="flex gap-1">
                <button onclick="changeCounter('${key}', -1)" class="bg-gray-700 active:bg-gray-600 w-9 h-9 rounded-lg font-bold">−</button>
                <button onclick="changeCounter('${key}', 1)" class="bg-gray-700 active:bg-gray-600 w-9 h-9 rounded-lg font-bold">+</button>
            </div>` : ''}
        </div>`;
    document.getElementById('counters').innerHTML = card('💀 Morts', c.deaths, null, 'text-red-400')
        + card('🎯 Captures', c.captures, null, 'text-green-400')
        + card('🏅 Badges', c.badges, 'badges', 'text-yellow-400')
        + card('🔁 Tentative', c.attempts, 'attempts', 'text-sky-400');
}

function changeCounter(key, delta) {
    const counters = { badges: 0, attempts: 1, ...state.counters };
    const min = key === 'attempts' ? 1 : 0;
    counters[key] = Math.max(min, Math.min(999, (Number(counters[key]) || min) + delta));
    state.counters = counters;
    commit();
}

function renderTeam() {
    document.getElementById('team').innerHTML = state.team.map((p, i) => p ? `
        <div class="bg-gray-800 rounded-xl p-2 flex items-center gap-3">
            ${spriteImgHtml(p, 'local', 'class="w-12 h-12 object-contain" alt=""')}
            <div class="flex-1 min-w-0">
                <div class="font-bold truncate">${escapeHtml(p.nickname)} ${p.isShiny ? '<span class="text-yellow-400">✨</span>' : ''}</div>
                <div class="text-xs text-gray-400 truncate">${escapeHtml(p.frSpecies)}${p.level ? ` · Niv. ${escapeHtml(p.level)}` : ''}${p.route ? ` · ${escapeHtml(p.route)}` : ''}</div>
            </div>
            <button onclick="openDeathSheet(${i})" class="bg-red-600 active:bg-red-700 px-4 py-3 rounded-lg font-bold">⚰️</button>
        </div>` : `
        <div class="border border-dashed border-gray-700 rounded-xl p-3 text-sm text-gray-600">Slot ${i + 1} vide</div>`).join('');
}

function renderCemetery() {
    const recent = state.cemetery.slice(-5).reverse();
    document.getElementById('cemetery').innerHTML = recent.length === 0
        ? '<p class="text-sm text-gray-500 italic">Aucun mort... pour l\'instant.</p>'
        : recent.map(p => `
            <div class="bg-gray-800 rounded-lg px-3 py-2 text-sm">
                <span class="font-bold text-red-400">${escapeHtml(p.nickname)}</span>
                <span class="text-gray-400">${p.level ? `Niv. ${escapeHtml(p.level)}` : ''}${p.deathCause ? ` — ${escapeHtml(p.deathCause)}` : ''}</span>
            </div>`).join('');
}

function renderRouteList() {
    const all = [...state.team, ...state.boxes.flat(), ...state.cemetery].filter(Boolean);
    const routes = [...new Set(all.map(p => p.route).filter(Boolean))];
    document.getElementById('route-list').innerHTML = routes.map(r => `<option value="${escapeHtml(r)}"></option>`).join('');
}

function render() {
    renderCounters();
    renderTeam();
    renderCemetery();
    renderRouteList();
}

function quickCapture(event) {
    event.preventDefault();
    const frSpecies = document.getElementById('q-spec').value.trim();
    if (!frSpecies) return showToast("Indiquez l'espèce.", 'error');
    const nickname = document.getElementById('q-nick').value.trim();
    remember();
    const slot = placePokemon(state, {
        nickname: nickname || frSpecies,
        frSpecies,
        enSpecies: getEnName(frSpecies),
        gender: document.getElementById('q-gender').value,
        isShiny: document.getElementById('q-shiny').checked,
        level: document.getElementById('q-level').value,
        route: document.getElementById('q-route').value
    });
    if (!slot) {
        undoStack.pop();
        return showToast('Équipe et PC pleins.', 'error');
    }
    commit();
    document.getElementById('capture-form').reset();
    showToast(slot.type === 'team' ? `➕ ${nickname || frSpecies} rejoint l'équipe` : `➕ ${nickname || frSpecies} → Boîte ${slot.boxIndex + 1}`);
}

function openDeathSheet(index) {
    const p = state.team[index];
    if (!p) return;
    pendingDeathIndex = index;
    document.getElementById('death-name').textContent = p.nickname;
    document.getElementById('death-level').value = p.level || '';
    document.getElementById('death-cause').value = '';
    document.getElementById('death-sheet').classList.remove('hidden');
}

function closeDeathSheet() {
    pendingDeathIndex = null;
    document.getElementById('death-sheet').classList.add('hidden');
}

function confirmDeath(event) {
    event.preventDefault();
    if (pendingDeathIndex === null) return;
    remember();
    const entry = recordDeath(state, { type: 'team', index: pendingDeathIndex }, {
        level: document.getElementById('death-level').value,
        cause: document.getElementById('death-cause').value
    });
    closeDeathSheet();
    if (!entry) {
        undoStack.pop();
        return;
    }
    commit();
    showToast(`⚰️ ${entry.nickname} repose en paix.`);
}

function setConnected(connected) {
    document.getElementById('conn-dot').className = `w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`;
    document.getElementById('conn-banner').classList.toggle('hidden', connected);
}

socket.on('connect', () => setConnected(true));
socket.on('disconnect', () => setConnected(false));
socket.on('connect_error', () => setConnected(false));

socket.on('init', data => {
    pokemonDict = data.dict;
    state = data.state;
    document.getElementById('pokemon-list').innerHTML = pokemonDict.map(p => `<option value="${escapeHtml(p.fr)}"></option>`).join('');
    render();
});

socket.on('state_updated', newState => {
    state = newState;
    render();
});
