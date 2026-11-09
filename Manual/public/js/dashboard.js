const socket = io();
let pokemonDict = [];
let currentState = createEmptyState();
let selectedBoxIndex = null; 
let pendingDeathData = null; 
let pcSearchTimeout = null;

let stateHistory = [];

function saveStateToHistory() {
    stateHistory.push(JSON.parse(JSON.stringify(currentState)));
    if (stateHistory.length > 20) stateHistory.shift(); 
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.classList.remove('hidden');
}

function undoLastAction() {
    if (stateHistory.length === 0) {
        showToast("Rien à annuler.", "error");
        return;
    }
    if (stateHistory.length > 0) {
        currentState = stateHistory.pop();
        commitState();
        renderAll();
        showToast("⏪ Action annulée avec succès !");
        updateUndoButton();
    }
}

// --- UTILS TRADUCTION & SPRITES ---
function getEnName(frName) {
    if (!frName) return '';
    const found = pokemonDict.find(p => p.fr.toLowerCase() === frName.toLowerCase());
    return found ? found.en : frName; 
}


function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-lg shadow-2xl text-sm font-bold transition-all transform translate-y-2 opacity-0 flex items-center gap-2 ${
        type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
    }`;
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function commitState() {
    saveToLocalStorage();
    socket.emit('update_state', currentState);
    renderCounters();
    renderRouteList();
}

function syncQuickCemeteryInputs() {
    const qStart = document.getElementById('quick-cem-start');
    const qEnd = document.getElementById('quick-cem-end');
    if (qStart && currentState.config) qStart.value = currentState.config.cemeteryStartText || '';
    if (qEnd && currentState.config) qEnd.value = currentState.config.cemeteryEndText || '';
}

function renderAll() {
    renderTeamForm();
    renderBoxGrid();
    renderBoxSlotPanel();
    renderCemetery();
    renderCounters();
    renderRouteList();
    syncQuickCemeteryInputs();
}

function updateUndoButton() {
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.classList.toggle('hidden', stateHistory.length === 0);
}

function saveToLocalStorage() {
    localStorage.setItem('poke_stream_manual_state_v4', JSON.stringify(currentState));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('poke_stream_manual_state_v4');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.team)) {
                currentState = sanitizeImportedState(parsed);
            }
        } catch (e) {
            console.error("Erreur de stockage local :", e);
        }
    }
}

// --- SYSTEME DE DRAG & DROP MULTI-ZONES ---
function handleDragStart(event, type, index) {
    let p = null;
    if (type === 'team') p = currentState.team[index];
    if (type === 'box') p = currentState.boxes[currentState.currentBoxIndex][index];
    
    if (!p) {
        event.preventDefault();
        return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify({ type, index }));
    
    // Effet visuel transparent au glisser
    setTimeout(() => {
        event.target.classList.add('opacity-40', 'border-dashed', 'border-sky-500');
    }, 10);
}

function handleDragEnd(event) {
    event.target.classList.remove('opacity-40', 'border-dashed', 'border-sky-500');
}

function handleDragOver(event) {
    event.preventDefault(); 
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function formatPokemonForDestination(p, destType) {
    if (!p) return null;
    const enSpecies = p.enSpecies || getEnName(p.frSpecies || p.nickname || '');
    return makePokemon({ ...p, enSpecies }, destType);
}

function handleDrop(event, targetType, targetIndex) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    try {
        const sourceData = JSON.parse(event.dataTransfer.getData('application/json'));
        const sourceType = sourceData.type;
        const sourceIndex = sourceData.index;

        // Bloque le drag sur lui même
        if (sourceType === targetType && sourceIndex === targetIndex) return; 

        saveStateToHistory(); 

        let sourcePokemon = null;
        let targetPokemon = null;

        if (sourceType === 'team') sourcePokemon = currentState.team[sourceIndex];
        else if (sourceType === 'box') sourcePokemon = currentState.boxes[currentState.currentBoxIndex][sourceIndex];

        if (targetType === 'team') targetPokemon = currentState.team[targetIndex];
        else if (targetType === 'box') targetPokemon = currentState.boxes[currentState.currentBoxIndex][targetIndex];

        // Échange formatté (Swap)
        if (targetType === 'team') currentState.team[targetIndex] = formatPokemonForDestination(sourcePokemon, 'team');
        else currentState.boxes[currentState.currentBoxIndex][targetIndex] = formatPokemonForDestination(sourcePokemon, 'box');

        if (sourceType === 'team') currentState.team[sourceIndex] = formatPokemonForDestination(targetPokemon, 'team');
        else currentState.boxes[currentState.currentBoxIndex][sourceIndex] = formatPokemonForDestination(targetPokemon, 'box');

        commitState();
        
        renderTeamForm();
        renderBoxGrid();
        renderBoxSlotPanel();
        showToast("🔄 Échange Drag & Drop réussi !");

    } catch (err) {
        console.error("Erreur Drag&Drop:", err);
    }
}

function handleCemeteryDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('cem-drag-over');
}

function handleCemeteryDragLeave(event) {
    event.currentTarget.classList.remove('cem-drag-over');
}

function handleDropCemetery(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('cem-drag-over');

    try {
        const sourceData = JSON.parse(event.dataTransfer.getData('application/json'));
        const sourceType = sourceData.type;
        const sourceIndex = sourceData.index;

        let sourcePokemon = null;
        if (sourceType === 'team') sourcePokemon = currentState.team[sourceIndex];
        else if (sourceType === 'box') sourcePokemon = currentState.boxes[currentState.currentBoxIndex][sourceIndex];

        if (sourcePokemon) {
            openDeathModal(sourcePokemon.nickname, { type: sourceType === 'box' ? 'pc' : sourceType, index: sourceIndex });
        }
    } catch (err) {
        console.error("Erreur Drag&Drop Cimetière :", err);
    }
}


// --- MODAL DE CONFIG ---
function openConfigModal() {
    const config = { ...DEFAULT_CONFIG, ...currentState.config };
    
    document.getElementById('cfg-cem-speed').value = config.cemeterySpeed;
    document.getElementById('cfg-cem-pause').value = config.cemeteryPause;
    document.getElementById('cfg-cem-start').value = config.cemeteryStartText;
    document.getElementById('cfg-cem-end').value = config.cemeteryEndText;
    document.getElementById('cfg-box-slide').value = config.boxSlideDuration;
    document.getElementById('cfg-box-cycle').value = config.boxCycleDuration || 5;

    const modal = document.getElementById('config-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.firstElementChild.classList.remove('scale-95');
    }, 10);
}

function closeConfigModal() {
    const modal = document.getElementById('config-modal');
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function saveConfig() {
    currentState.config = {
        cemeterySpeed: Number(document.getElementById('cfg-cem-speed').value) || DEFAULT_CONFIG.cemeterySpeed,
        cemeteryPause: Number(document.getElementById('cfg-cem-pause').value) || DEFAULT_CONFIG.cemeteryPause,
        cemeteryStartText: document.getElementById('cfg-cem-start').value.trim() || DEFAULT_CONFIG.cemeteryStartText,
        cemeteryEndText: document.getElementById('cfg-cem-end').value.trim() || DEFAULT_CONFIG.cemeteryEndText,
        boxSlideDuration: Number(document.getElementById('cfg-box-slide').value) || DEFAULT_CONFIG.boxSlideDuration,
        boxCycleDuration: Number(document.getElementById('cfg-box-cycle').value) || DEFAULT_CONFIG.boxCycleDuration
    };
    
    commitState();
    
    const qStart = document.getElementById('quick-cem-start');
    const qEnd = document.getElementById('quick-cem-end');
    if (qStart) qStart.value = currentState.config.cemeteryStartText;
    if (qEnd) qEnd.value = currentState.config.cemeteryEndText;

    closeConfigModal();
    showToast("⚙️ Configurations sauvegardées et appliquées sur OBS !");
}

function updateQuickCemeteryTexts() {
    if (!currentState.config) {
        currentState.config = { ...DEFAULT_CONFIG };
    }
    currentState.config.cemeteryStartText = document.getElementById('quick-cem-start').value.trim() || DEFAULT_CONFIG.cemeteryStartText;
    currentState.config.cemeteryEndText = document.getElementById('quick-cem-end').value.trim() || DEFAULT_CONFIG.cemeteryEndText;
    
    commitState();
    showToast("✏️ Textes du cimetière mis à jour !");
}

socket.on('init', (data) => {
    pokemonDict = data.dict;
    loadFromLocalStorage();

    if (!currentState.boxes || !Array.isArray(currentState.boxes)) {
        currentState.boxes = [Array(30).fill(null)];
    }
    if (currentState.currentBoxIndex >= currentState.boxes.length) {
        currentState.currentBoxIndex = 0;
    }
    if (!currentState.config) {
        currentState.config = { ...DEFAULT_CONFIG };
    }

    const serverStateIsEmpty = !data.state.team.some(p => p !== null) && 
                              !data.state.boxes?.some(box => box.some(p => p !== null)) && 
                              data.state.cemetery.length === 0;

    const localStateHasData = currentState.team.some(p => p !== null) || 
                             currentState.boxes.some(box => box.some(p => p !== null)) || 
                             currentState.cemetery.length > 0;

    if (!serverStateIsEmpty) {
        currentState = data.state;
        saveToLocalStorage();
    } else if (localStateHasData) {
        socket.emit('update_state', currentState);
        showToast("🔄 Session restaurée depuis votre sauvegarde locale !");
    } else {
        currentState = data.state;
    }
    
    renderMobileInfo(data.info);

    const dataList = document.getElementById('pokemon-list');
    dataList.innerHTML = '';
    pokemonDict.forEach(p => {
        const option = document.createElement('option');
        option.value = p.fr; 
        dataList.appendChild(option);
    });

    renderAll();
});

socket.on('state_updated', (newState) => {
    const currentStr = JSON.stringify(currentState);
    const newStr = JSON.stringify(newState);
    
    if (currentStr === newStr) return;

    currentState = newState;
    saveToLocalStorage();
    syncQuickCemeteryInputs();
    renderCounters();
    renderRouteList();

    const activeId = document.activeElement ? document.activeElement.id : null;
    const isTypingInTeam = activeId && activeId.startsWith('t-');
    const isTypingInBox = activeId && activeId.startsWith('b-');
    const isSearching = activeId === 'pc-search-input';

    if (!isTypingInTeam) {
        renderTeamForm();
    }
    renderBoxGrid();
    if (!isTypingInBox && !isSearching) {
        renderBoxSlotPanel();
    }
    renderCemetery();
});

function handlePCSearchDebounced() {
    if (pcSearchTimeout) clearTimeout(pcSearchTimeout);
    pcSearchTimeout = setTimeout(handlePCSearch, 300);
}

function handlePCSearch() {
    const query = document.getElementById('pc-search-input').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('pc-search-results');
    
    if (query === "") {
        resultsDiv.classList.add('hidden');
        resultsDiv.innerHTML = "";
        return;
    }

    const matches = [];
    currentState.boxes.forEach((box, bIdx) => {
        box.forEach((p, sIdx) => {
            if (p) {
                const nameFr = (p.frSpecies || "").toLowerCase();
                const nameEn = (p.enSpecies || "").toLowerCase();
                const nick = (p.nickname || "").toLowerCase();
                if (nameFr.includes(query) || nameEn.includes(query) || nick.includes(query)) {
                    matches.push({ boxIndex: bIdx, slotIndex: sIdx, pokemon: p });
                }
            }
        });
    });

    if (matches.length === 0) {
        resultsDiv.innerHTML = `<div class="px-4 py-2.5 text-xs text-gray-500 italic">Aucun résultat trouvé</div>`;
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = matches.slice(0, 5).map(m => `
        <button onclick="goToSearchResult(${m.boxIndex}, ${m.slotIndex})" class="w-full text-left px-4 py-2 text-xs hover:bg-sky-600 hover:text-white transition-colors flex items-center justify-between border-b border-gray-800 last:border-0">
            <div class="flex items-center gap-2">
                <img src="${escapeHtml(m.pokemon.sprite)}" class="w-6 h-6 object-contain" onerror="this.src='https://img.pokemondb.net/sprites/home/normal/${getSpriteString(m.pokemon.enSpecies)}.png'; this.onerror=null;">
                <div>
                    <span class="font-bold text-sky-400">${escapeHtml(m.pokemon.nickname)}</span>
                    <span class="text-gray-400 font-normal">(${escapeHtml(m.pokemon.frSpecies)})</span>
                </div>
            </div>
            <span class="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-bold uppercase">Boîte ${m.boxIndex + 1}</span>
        </button>
    `).join('');
    resultsDiv.classList.remove('hidden');
}

function goToSearchResult(boxIdx, slotIdx) {
    currentState.currentBoxIndex = boxIdx;
    selectedBoxIndex = slotIdx;
    document.getElementById('pc-search-input').value = "";
    document.getElementById('pc-search-results').classList.add('hidden');
    commitState();
    renderBoxGrid();
    renderBoxSlotPanel();
    showToast(`📍 Localisé dans la Boîte ${boxIdx + 1} (Slot ${slotIdx + 1}) !`);
}

function renderTeamForm() {
    const container = document.getElementById('team-container');
    container.innerHTML = '';

    for (let i = 0; i < 6; i++) {
        const p = currentState.team[i];
        const div = document.createElement('div');
        div.className = `p-4 rounded-lg relative border shadow flex flex-col justify-between transition-all ${
            p && p.isShiny ? 'bg-gradient-to-br from-yellow-950/40 to-gray-700/60 border-yellow-500/50' : 'bg-gray-700 border-gray-600'
        }`;
        
        // Intégration Drag & Drop sur le parent de la carte Équipe
        div.draggable = true;
        div.ondragstart = (e) => handleDragStart(e, 'team', i);
        div.ondragend = handleDragEnd;
        div.ondragover = handleDragOver;
        div.ondragleave = handleDragLeave;
        div.ondrop = (e) => handleDrop(e, 'team', i);
        
        div.innerHTML = `
            <div class="absolute top-2 left-2 cursor-move text-gray-400 hover:text-white" title="Déplacez pour échanger">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path></svg>
            </div>
            <div class="absolute top-2 right-2 flex gap-1">
                <button id="dead-btn-${i}" onclick="triggerTeamDead(${i})" class="${p ? '' : 'hidden '}text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors" title="Envoyer directement au Cimetière">⚰️</button>
                <button onclick="clearTeamSlot(${i})" class="text-xs bg-gray-600 hover:bg-red-500 text-white px-2 py-1 rounded transition-colors" title="Vider le slot">🗑️</button>
            </div>
            <span class="text-xs text-gray-400 font-bold mb-1 block font-mono text-center">Slot ${i + 1} <span class="text-gray-600 font-normal">· Alt+${i + 1}</span></span>
            <input type="text" id="t-nick-${i}" placeholder="Surnom" value="${p ? escapeHtml(p.nickname) : ''}" class="w-full bg-gray-900 text-white px-3 py-1.5 rounded mb-1.5 border border-gray-600 text-sm focus:border-blue-500 outline-none" onchange="autoFillTeamSpecies(${i})">
            <input type="text" id="t-spec-${i}" list="pokemon-list" placeholder="Espèce (Français)" value="${p ? escapeHtml(p.frSpecies) : ''}" class="w-full bg-gray-900 text-white px-3 py-1.5 rounded mb-2 border border-gray-600 text-sm focus:border-blue-500 outline-none" onchange="updateTeamStateFromUI()">
            <div class="flex gap-1.5 mb-2">
                <input type="number" id="t-level-${i}" min="1" max="100" placeholder="Niv." value="${p && p.level ? escapeHtml(p.level) : ''}" class="w-16 bg-gray-900 text-white px-2 py-1 rounded border border-gray-600 text-xs focus:border-blue-500 outline-none" onchange="updateTeamStateFromUI()">
                <input type="text" id="t-route-${i}" list="route-list" placeholder="Lieu de capture" value="${p && p.route ? escapeHtml(p.route) : ''}" class="flex-1 min-w-0 bg-gray-900 text-white px-2 py-1 rounded border border-gray-600 text-xs focus:border-blue-500 outline-none" onchange="updateTeamStateFromUI()">
            </div>

            <div class="flex items-center justify-between mt-1">
                <div class="flex gap-2">
                    <label class="flex items-center text-sm cursor-pointer"><input type="radio" name="gender-${i}" value="M" ${p && p.gender === 'M' ? 'checked' : ''} class="mr-1 text-blue-500" onchange="updateTeamStateFromUI()"> ♂️</label>
                    <label class="flex items-center text-sm cursor-pointer"><input type="radio" name="gender-${i}" value="F" ${p && p.gender === 'F' ? 'checked' : ''} class="mr-1 text-pink-500" onchange="updateTeamStateFromUI()"> ♀️</label>
                    <label class="flex items-center text-sm cursor-pointer"><input type="radio" name="gender-${i}" value="None" ${!p || p.gender === 'None' ? 'checked' : ''} class="mr-1" onchange="updateTeamStateFromUI()"> ⚪</label>
                </div>
                <label class="flex items-center text-xs text-yellow-400 cursor-pointer font-bold bg-yellow-950/40 px-2 py-1 rounded border border-yellow-500/20">
                    <input type="checkbox" id="t-shiny-${i}" ${p && p.isShiny ? 'checked' : ''} class="mr-1 accent-yellow-500" onchange="updateTeamStateFromUI()"> ✨ Shiny
                </label>
            </div>
        `;
        container.appendChild(div);
    }
}

function autoFillTeamSpecies(index) {
    const nickInput = document.getElementById(`t-nick-${index}`);
    const specInput = document.getElementById(`t-spec-${index}`);
    if (nickInput && specInput && nickInput.value && !specInput.value) {
        const inputValue = nickInput.value.trim().toLowerCase();
        const isKnown = pokemonDict.some(p => p.fr.toLowerCase() === inputValue);
        if (isKnown) {
            specInput.value = nickInput.value;
        }
    }
    updateTeamStateFromUI();
}

function clearTeamSlot(index) {
    saveStateToHistory();
    currentState.team[index] = null;
    commitState();
    renderTeamForm();
    showToast(`Slot équipe ${index + 1} vidé.`);
}

function updateTeamStateFromUI() {
    for (let i = 0; i < 6; i++) {
        const nickInput = document.getElementById(`t-nick-${i}`);
        const specInput = document.getElementById(`t-spec-${i}`);
        if (!nickInput || !specInput) continue;

        const nickname = nickInput.value.trim();
        const frSpecies = specInput.value.trim();
        
        const genderEl = document.querySelector(`input[name="gender-${i}"]:checked`);
        const gender = genderEl ? genderEl.value : 'None';
        
        const shinyEl = document.getElementById(`t-shiny-${i}`);
        const isShiny = shinyEl ? shinyEl.checked : false;

        if (!nickname && !frSpecies) {
            currentState.team[i] = null;
            continue;
        }

        const level = document.getElementById(`t-level-${i}`)?.value || '';
        const route = document.getElementById(`t-route-${i}`)?.value || '';
        currentState.team[i] = makePokemon({ nickname, frSpecies, enSpecies: getEnName(frSpecies || nickname), gender, isShiny, level, route }, 'team');
    }
    for (let i = 0; i < 6; i++) {
        const deadBtn = document.getElementById(`dead-btn-${i}`);
        if (deadBtn) deadBtn.classList.toggle('hidden', !currentState.team[i]);
    }
    commitState();
}

function openDeathModal(pokemonName, sourceInfo) {
    const modal = document.getElementById('death-details-modal');
    if (!modal.classList.contains('hidden')) {
        showToast("⚠️ Veuillez d'abord fermer le registre actuel.", "error");
        return;
    }

    pendingDeathData = sourceInfo; 
    document.getElementById('death-modal-subtitle').innerText = `Gravure dans la pierre de : ${pokemonName}`;
    const pokemon = getSourcePokemon(sourceInfo);
    const levelInput = document.getElementById('death-level');
    levelInput.value = pokemon && pokemon.level ? pokemon.level : "";
    document.getElementById('death-cause').value = "";

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.firstElementChild.classList.remove('scale-95');
        (levelInput.value ? document.getElementById('death-cause') : levelInput).focus();
    }, 10);
}

function getSourcePokemon(source) {
    if (!source) return null;
    if (source.type === 'team') return currentState.team[source.index];
    if (source.type === 'pc') return currentState.boxes[currentState.currentBoxIndex][source.index];
    return source.data || null;
}

function closeDeathModal() {
    const modal = document.getElementById('death-details-modal');
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
    pendingDeathData = null;
}

function confirmDeathSend() {
    if (!pendingDeathData) return;

    const level = document.getElementById('death-level').value.trim();
    const cause = document.getElementById('death-cause').value.trim();

    saveStateToHistory();
    const source = pendingDeathData.type === 'pc' ? { ...pendingDeathData, boxIndex: currentState.currentBoxIndex } : pendingDeathData;
    const entry = recordDeath(currentState, source, { level, cause });

    if (entry) {
        commitState();
        renderTeamForm();
        renderBoxGrid();
        renderBoxSlotPanel();
        renderCemetery();
        showToast(`⚰️ ${entry.nickname} repose désormais en paix au cimetière.`);
    } else {
        stateHistory.pop();
        updateUndoButton();
    }

    closeDeathModal();
}

function triggerTeamDead(index) {
    const p = currentState.team[index];
    if (!p) return;
    openDeathModal(p.nickname, { type: 'team', index: index });
}

function triggerPCDead(index) {
    const p = currentState.boxes[currentState.currentBoxIndex][index];
    if (!p) return;
    openDeathModal(p.nickname, { type: 'pc', index: index });
}

function triggerManualDead() {
    const nickInput = document.getElementById('dead-nick');
    const specInput = document.getElementById('dead-species');
    const nickname = nickInput.value.trim();
    const frSpecies = specInput.value.trim();

    if (!nickname && !frSpecies) {
        showToast("⚠️ Surnom ou Espèce de deuil manquant.", "error");
        return;
    }

    const enSpecies = getEnName(frSpecies || nickname);
    const dummyPkmn = { nickname: nickname || frSpecies, frSpecies: frSpecies || nickname, enSpecies: enSpecies };
    
    nickInput.value = '';
    specInput.value = '';

    openDeathModal(dummyPkmn.nickname, { type: 'manual', data: dummyPkmn });
}

function renderBoxGrid() {
    const grid = document.getElementById('box-grid');
    const currentBox = currentState.boxes[currentState.currentBoxIndex];

    if (grid.children.length !== 30) {
        grid.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const button = document.createElement('button');
            button.id = `box-btn-${i}`;
            button.onclick = () => selectBoxSlot(i);
            
            // Intégration Drag & Drop sur chaque slot PC
            button.draggable = true;
            button.ondragstart = (e) => handleDragStart(e, 'box', i);
            button.ondragend = handleDragEnd;
            button.ondragover = handleDragOver;
            button.ondragleave = handleDragLeave;
            button.ondrop = (e) => handleDrop(e, 'box', i);

            grid.appendChild(button);
        }
    }

    for (let i = 0; i < 30; i++) {
        const p = currentBox[i];
        const button = document.getElementById(`box-btn-${i}`);
        const isSelected = selectedBoxIndex === i;

        const stateHash = p ? `${p.enSpecies}-${p.nickname}-${p.isShiny}-${isSelected}` : `empty-${isSelected}`;
        if (button.getAttribute('data-hash') === stateHash) continue;
        
        button.setAttribute('data-hash', stateHash);

        button.className = `w-10 h-10 rounded border flex items-center justify-center transition-all relative cursor-pointer ${
            p ? 'bg-gray-800 border-sky-500 hover:bg-sky-950 shadow-md' : 'bg-gray-950 border-gray-700 hover:border-gray-500 text-gray-600'
        } ${isSelected ? 'ring-2 ring-yellow-400 scale-105 bg-sky-900' : ''}`;
        
        button.title = p ? `${p.nickname} (${p.frSpecies}) - Boîte ${currentState.currentBoxIndex+1} / Slot ${i+1}` : `Slot ${i+1} vide`;

        if (p) {
            button.innerHTML = `
                ${p.isShiny ? '<span class="absolute text-[8px] top-0.5 right-0.5 text-yellow-400 drop-shadow-[0_1px_1px_rgba(0,0,0,1)] z-10 select-none">★</span>' : ''}
                <img src="${escapeHtml(p.sprite)}" class="w-8 h-8 object-contain" onerror="this.src='https://img.pokemondb.net/sprites/home/normal/${getSpriteString(p.enSpecies)}.png'; this.onerror=null;">
            `;
        } else {
            button.innerHTML = `<span class="text-xs font-mono">+</span>`;
        }
    }

    const navLabel = document.getElementById('box-navigation-label');
    if (navLabel) {
        navLabel.innerText = `Boîte ${currentState.currentBoxIndex + 1} / ${currentState.boxes.length}`;
    }
}

function selectBoxSlot(index) {
    selectedBoxIndex = index;
    renderBoxGrid();
    renderBoxSlotPanel();
}

function prevBox() {
    if (currentState.currentBoxIndex > 0) {
        currentState.currentBoxIndex--;
        selectedBoxIndex = null;
        commitState();
        renderBoxGrid();
        renderBoxSlotPanel();
        showToast(`Affichage : Boîte PC ${currentState.currentBoxIndex + 1}`);
    }
}

function nextBox() {
    if (currentState.currentBoxIndex < currentState.boxes.length - 1) {
        currentState.currentBoxIndex++;
        selectedBoxIndex = null;
        commitState();
        renderBoxGrid();
        renderBoxSlotPanel();
        showToast(`Affichage : Boîte PC ${currentState.currentBoxIndex + 1}`);
    }
}

function addNewBox() {
    currentState.boxes.push(Array(30).fill(null));
    currentState.currentBoxIndex = currentState.boxes.length - 1;
    selectedBoxIndex = null;
    commitState();
    renderBoxGrid();
    renderBoxSlotPanel();
    showToast(`📦 Nouvelle Boîte PC ${currentState.boxes.length} ajoutée !`);
}

let boxDeleteConfirmActive = false;
function deleteCurrentBox(btn) {
    if (currentState.boxes.length <= 1) {
        showToast("⚠️ Impossible de supprimer l'unique Boîte PC existante !", "error");
        return;
    }

    if (!boxDeleteConfirmActive) {
        boxDeleteConfirmActive = true;
        btn.innerText = "Sûr ?";
        btn.className = "bg-red-700 hover:bg-red-800 px-2 py-1 rounded text-xs font-bold transition-all";
        setTimeout(() => {
            boxDeleteConfirmActive = false;
            btn.innerText = "🗑️";
            btn.className = "bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-bold transition-all";
        }, 3000);
    } else {
        boxDeleteConfirmActive = false;
        btn.innerText = "🗑️";
        btn.className = "bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-bold transition-all";
        
        saveStateToHistory(); 
        currentState.boxes.splice(currentState.currentBoxIndex, 1);
        
        if (currentState.currentBoxIndex >= currentState.boxes.length) {
            currentState.currentBoxIndex = currentState.boxes.length - 1;
        }
        selectedBoxIndex = null;
        
        commitState();
        renderBoxGrid();
        renderBoxSlotPanel();
        showToast("🗑️ Boîte PC supprimée !");
    }
}

function renderBoxSlotPanel() {
    const panel = document.getElementById('box-slot-panel');
    if (selectedBoxIndex === null) {
        panel.innerHTML = `<p class="text-sm text-gray-300 italic text-center py-8 animate-pulse">Sélectionnez un slot (1-30) de la boîte active ci-dessus pour le configurer.</p>`;
        return;
    }

    const p = currentState.boxes[currentState.currentBoxIndex][selectedBoxIndex];
    panel.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-xs font-bold text-sky-400">📝 Slot ${selectedBoxIndex + 1} (Boîte ${currentState.currentBoxIndex + 1})</h3>
            <button onclick="closeBoxSlotPanel()" class="text-xs text-gray-400 hover:text-white">Fermer ✖</button>
        </div>

        <div class="space-y-2">
            <div>
                <label class="block text-xs text-gray-400 mb-0.5">Surnom</label>
                <input type="text" id="b-nick" placeholder="Ex: Bulbizarre" value="${p ? escapeHtml(p.nickname) : ''}" class="w-full bg-gray-900 text-white px-3 py-1.5 rounded border border-gray-600 text-sm focus:border-blue-500 outline-none">
            </div>
            <div>
                <label class="block text-xs text-gray-400 mb-0.5">Espèce (Français)</label>
                <input type="text" id="b-spec" list="pokemon-list" placeholder="Ex: Bulbizarre" value="${p ? escapeHtml(p.frSpecies) : ''}" class="w-full bg-gray-900 text-white px-3 py-1.5 rounded border border-gray-600 text-sm focus:border-blue-500 outline-none">
            </div>
            
            <div class="grid grid-cols-3 gap-2">
                <div>
                    <label class="block text-xs text-gray-400 mb-0.5">Niveau</label>
                    <input type="number" id="b-level" min="1" max="100" placeholder="Niv." value="${p && p.level ? escapeHtml(p.level) : ''}" class="w-full bg-gray-900 text-white px-2 py-1.5 rounded border border-gray-600 text-sm focus:border-blue-500 outline-none">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs text-gray-400 mb-0.5">Lieu de capture</label>
                    <input type="text" id="b-route" list="route-list" placeholder="Ex: Route 1" value="${p && p.route ? escapeHtml(p.route) : ''}" class="w-full bg-gray-900 text-white px-3 py-1.5 rounded border border-gray-600 text-sm focus:border-blue-500 outline-none">
                </div>
            </div>
            <div class="flex items-center justify-between py-1 bg-gray-800/40 p-2 rounded border border-gray-700/30">
                <div class="flex gap-2">
                    <label class="flex items-center text-xs cursor-pointer"><input type="radio" name="b-gender" value="M" ${p && p.gender === 'M' ? 'checked' : ''} class="mr-1"> ♂️</label>
                    <label class="flex items-center text-xs cursor-pointer"><input type="radio" name="b-gender" value="F" ${p && p.gender === 'F' ? 'checked' : ''} class="mr-1"> ♀️</label>
                    <label class="flex items-center text-xs cursor-pointer"><input type="radio" name="b-gender" value="None" ${!p || p.gender === 'None' ? 'checked' : ''} class="mr-1"> ⚪</label>
                </div>
                <label class="flex items-center text-xs text-yellow-400 font-bold cursor-pointer bg-yellow-950/20 px-2 py-0.5 rounded border border-yellow-500/10">
                    <input type="checkbox" id="b-shiny" ${p && p.isShiny ? 'checked' : ''} class="mr-1 accent-yellow-500"> ✨ Shiny
                </label>
            </div>

            <div class="pt-2 flex flex-col gap-2">
                <button onclick="saveBoxSlot()" class="w-full bg-sky-600 hover:bg-sky-700 text-white py-1.5 rounded font-bold text-sm transition-colors shadow">
                    💾 Enregistrer le Slot PC
                </button>

                ${p ? `
                    <div class="flex gap-2 mt-2">
                        <button onclick="triggerPCDead(${selectedBoxIndex})" class="flex-1 bg-red-600 hover:bg-red-700 py-1.5 rounded text-xs font-bold transition-colors">
                            ⚰️ Cimetière
                        </button>
                        <button onclick="clearBoxSlot(${selectedBoxIndex})" class="flex-1 bg-gray-600 hover:bg-red-500 py-1.5 rounded text-xs font-bold transition-colors">
                            🗑️ Libérer
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function closeBoxSlotPanel() {
    selectedBoxIndex = null;
    renderBoxGrid();
    renderBoxSlotPanel();
}

function saveBoxSlot() {
    if (selectedBoxIndex === null) return;

    const nickname = document.getElementById('b-nick').value.trim();
    const frSpecies = document.getElementById('b-spec').value.trim();
    
    const genderEl = document.querySelector('input[name="b-gender"]:checked');
    const gender = genderEl ? genderEl.value : 'None';
    
    const shinyEl = document.getElementById('b-shiny');
    const isShiny = shinyEl ? shinyEl.checked : false;

    if (!nickname && !frSpecies) {
        showToast("⚠️ Surnom ou Espèce manquant pour enregistrer.", "error");
        return;
    }

    const level = document.getElementById('b-level').value;
    const route = document.getElementById('b-route').value;
    currentState.boxes[currentState.currentBoxIndex][selectedBoxIndex] = makePokemon({ nickname, frSpecies, enSpecies: getEnName(frSpecies || nickname), gender, isShiny, level, route }, 'box');

    commitState();
    renderBoxGrid();
    renderBoxSlotPanel();
    showToast(`💾 Slot ${selectedBoxIndex + 1} (Boîte ${currentState.currentBoxIndex + 1}) mis à jour !`);
}

function clearBoxSlot(index) {
    saveStateToHistory(); 
    currentState.boxes[currentState.currentBoxIndex][index] = null;
    commitState();
    renderBoxGrid();
    renderBoxSlotPanel();
    showToast(`Slot PC ${index + 1} vidé.`);
}

function renderCemetery() {
    const container = document.getElementById('cemetery-list');
    container.innerHTML = '';
    
    if (currentState.cemetery.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic text-sm text-center py-4">Aucun mort... pour l\'instant.</p>';
        return;
    }

    currentState.cemetery.forEach((p, index) => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-900 p-2 rounded mb-2 border border-gray-700 shadow-inner";
        
        let detailsText = '';
        if (p.level || p.deathCause) {
            detailsText = `<div class="text-[10px] text-gray-400 italic font-medium mt-0.5">`;
            if (p.level) detailsText += `Niv. ${escapeHtml(p.level)}`;
            if (p.level && p.deathCause) detailsText += ` — `;
            if (p.deathCause) detailsText += escapeHtml(p.deathCause);
            detailsText += `</div>`;
        }
        const extra = [p.route ? `📍 ${escapeHtml(p.route)}` : '', formatDeathDate(p.diedAt)].filter(Boolean).join(' · ');
        if (extra) detailsText += `<div class="text-[10px] text-gray-500 mt-0.5">${extra}</div>`;

        div.innerHTML = `
            <div class="flex items-center">
                <img src="${escapeHtml(p.sprite)}" class="w-8 h-8 object-contain mr-3 filter grayscale" onerror="this.style.display='none'">
                <div>
                    <div class="font-bold text-red-400 text-sm flex items-center gap-1.5">
                        ${escapeHtml(p.nickname)}
                        <span class="text-[10px] text-gray-500 font-normal">(${escapeHtml(p.frSpecies)})</span>
                    </div>
                    ${detailsText}
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button onclick="resurrectToPC(${index})" class="text-xs bg-gray-800 hover:bg-sky-600 text-gray-400 hover:text-white px-1.5 py-1 rounded transition-colors" title="Ressusciter dans la Boîte PC active">📦</button>
                <button onclick="removeDead(${index})" class="text-gray-500 hover:text-red-500 px-1 text-lg transition-colors" title="Supprimer définitivement">✖</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function resurrectToPC(index) {
    const p = currentState.cemetery[index];
    if (!p) return;

    const emptyBoxIndex = currentState.boxes[currentState.currentBoxIndex].findIndex(slot => slot === null);
    if (emptyBoxIndex === -1) {
        showToast(`⚠️ La Boîte PC ${currentState.currentBoxIndex + 1} est pleine ! Créez une nouvelle boîte ou changez de boîte pour ressusciter.`, "error");
        return;
    }

    saveStateToHistory();
    const enSpecies = p.enSpecies || getEnName(p.frSpecies || p.nickname);
    currentState.boxes[currentState.currentBoxIndex][emptyBoxIndex] = makePokemon({ ...p, frSpecies: p.frSpecies || p.nickname, enSpecies }, 'box');

    currentState.cemetery.splice(index, 1);
    commitState();
    renderCemetery();
    renderBoxGrid();
    showToast(`🔮 ${p.nickname} ressuscité dans la Boîte PC ${currentState.currentBoxIndex + 1} (Slot ${emptyBoxIndex + 1}) !`);
}

function removeDead(index) {
    saveStateToHistory(); 
    const removed = currentState.cemetery[index];
    currentState.cemetery.splice(index, 1);
    commitState();
    renderCemetery();
    if (removed) {
        showToast(`🔮 ${removed.nickname} a été retiré du cimetière.`);
    }
}

function exportData() {
    updateTeamStateFromUI(); 
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "nuzlocke_save_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("💾 Sauvegarde téléchargée avec succès !");
}

function sanitizePokemon(p) {
    if (!p || typeof p !== 'object') return null;
    return {
        nickname: String(p.nickname || '').substring(0, 30),
        frSpecies: String(p.frSpecies || '').substring(0, 30),
        enSpecies: String(p.enSpecies || '').substring(0, 30),
        gender: ['M', 'F', 'None'].includes(p.gender) ? p.gender : 'None',
        isShiny: Boolean(p.isShiny),
        level: p.level ? String(p.level).substring(0, 3) : null,
        route: p.route ? String(p.route).substring(0, 40) : null,
        sprite: String(p.sprite || ''),
        fallback: String(p.fallback || '')
    };
}

function sanitizeImportedState(imported) {
    const safeState = createEmptyState();
    
    if (Array.isArray(imported.team)) {
        safeState.team = imported.team.map(p => sanitizePokemon(p)).slice(0, 6);
    }
    while(safeState.team.length < 6) safeState.team.push(null);

    const boxesArray = imported.boxes || (imported.box ? [imported.box] : []);
    if (Array.isArray(boxesArray) && boxesArray.length > 0) {
        safeState.boxes = boxesArray.map(box => {
            if (!Array.isArray(box)) return Array(30).fill(null);
            const safeBox = box.map(p => sanitizePokemon(p)).slice(0, 30);
            while(safeBox.length < 30) safeBox.push(null);
            return safeBox;
        });
    }
    
    if (Array.isArray(imported.cemetery)) {
        safeState.cemetery = imported.cemetery.map(p => {
            const safeP = sanitizePokemon(p);
            if (safeP) {
                safeP.level = p.level ? String(p.level).substring(0, 3) : null;
                safeP.deathCause = p.deathCause ? String(p.deathCause).substring(0, 100) : null;
                safeP.diedAt = typeof p.diedAt === 'string' ? p.diedAt.substring(0, 30) : null;
            }
            return safeP;
        }).filter(p => p !== null);
    }

    safeState.currentBoxIndex = typeof imported.currentBoxIndex === 'number' ? Math.max(0, Math.min(imported.currentBoxIndex, safeState.boxes.length - 1)) : 0;
    
    const importedCounters = imported.counters || {};
    safeState.counters = {
        badges: Math.max(0, Math.min(99, parseInt(importedCounters.badges, 10) || 0)),
        attempts: Math.max(1, Math.min(999, parseInt(importedCounters.attempts, 10) || 1))
    };

    const importedConfig = imported.config || {};
    safeState.config = {
        cemeterySpeed: Number(importedConfig.cemeterySpeed) || DEFAULT_CONFIG.cemeterySpeed,
        cemeteryPause: Number(importedConfig.cemeteryPause) || DEFAULT_CONFIG.cemeteryPause,
        cemeteryStartText: String(importedConfig.cemeteryStartText || DEFAULT_CONFIG.cemeteryStartText),
        cemeteryEndText: String(importedConfig.cemeteryEndText || DEFAULT_CONFIG.cemeteryEndText),
        boxSlideDuration: Number(importedConfig.boxSlideDuration) || DEFAULT_CONFIG.boxSlideDuration,
        boxCycleDuration: Number(importedConfig.boxCycleDuration) || DEFAULT_CONFIG.boxCycleDuration
    };

    return safeState;
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            saveStateToHistory(); 
            
            currentState = sanitizeImportedState(imported);
            commitState();
        renderAll();
        showToast("📥 Données importées et sécurisées avec succès !");
        } catch (err) {
            showToast("❌ Impossible de lire ce fichier JSON.", "error");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

let resetConfirmActive = false;
function clearAllData(btn) {
    if (!resetConfirmActive) {
        resetConfirmActive = true;
        btn.innerText = "Sûr ?";
        btn.className = "bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-all";
        setTimeout(() => {
            resetConfirmActive = false;
            btn.innerText = "⚠️ Tout réinitialiser";
            btn.className = "bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-all";
        }, 3000);
    } else {
        resetConfirmActive = false;
        btn.innerText = "⚠️ Tout réinitialiser";
        btn.className = "bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-all";
        
        saveStateToHistory(); 
        
        currentState = createEmptyState();
        selectedBoxIndex = null;
        commitState();
        renderAll();
        showToast("🗑️ Toutes vos données ont été nettoyées !");
    }
}


// --- CONNEXION AU SERVEUR ---
function setConnectionStatus(connected) {
    const dot = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    const banner = document.getElementById('conn-banner');
    if (!dot || !label) return;
    dot.className = `w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`;
    label.innerText = connected ? 'Serveur connecté' : 'Serveur déconnecté';
    label.className = connected ? 'text-green-400' : 'text-red-400';
    if (banner) banner.classList.toggle('hidden', connected);
}

socket.on('connect', () => setConnectionStatus(true));
socket.on('disconnect', () => setConnectionStatus(false));
socket.on('connect_error', () => setConnectionStatus(false));

// --- AIDE & MOBILE ---
function toggleHelpPanel() {
    document.getElementById('help-panel').classList.toggle('hidden');
}

function renderMobileInfo(info) {
    const container = document.getElementById('mobile-info');
    if (!container || !info) return;
    const localUrl = `${location.protocol}//${location.host}/mobile.html`;
    if (info.mobileUrls && info.mobileUrls.length > 0) {
        container.innerHTML = `<p>Sur le même Wi-Fi, ouvrez sur votre téléphone :</p>` +
            info.mobileUrls.map(url => `<p><a href="${escapeHtml(url)}" target="_blank" class="font-mono text-green-300 underline">${escapeHtml(url)}</a></p>`).join('');
    } else {
        container.innerHTML = `
            <p>Version compacte : <a href="${escapeHtml(localUrl)}" target="_blank" class="font-mono text-green-300 underline">${escapeHtml(localUrl)}</a></p>
            <p class="text-xs text-gray-400">Pour l'ouvrir depuis un téléphone, relancez le serveur avec <code class="bg-gray-900 px-1 rounded">HOST=0.0.0.0</code> : les adresses à utiliser s'afficheront ici.</p>`;
    }
}

// --- COMPTEURS ---
function counterCard(label, value, key, color) {
    const controls = key
        ? `<div class="flex gap-1">
               <button onclick="changeCounter('${key}', -1)" class="bg-gray-700 hover:bg-gray-600 w-8 h-8 rounded font-bold" title="Retirer 1">−</button>
               <button onclick="changeCounter('${key}', 1)" class="bg-gray-700 hover:bg-gray-600 w-8 h-8 rounded font-bold" title="Ajouter 1">+</button>
           </div>`
        : `<span class="text-[10px] text-gray-500 uppercase font-bold">auto</span>`;
    return `
        <div class="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between shadow">
            <div>
                <div class="text-xs text-gray-400 font-bold">${label}</div>
                <div class="text-2xl font-black ${color}">${value}</div>
            </div>
            ${controls}
        </div>`;
}

function renderCounters() {
    const bar = document.getElementById('counters-bar');
    if (!bar) return;
    const c = getCounters(currentState);
    bar.innerHTML = counterCard('💀 Morts', c.deaths, null, 'text-red-400')
        + counterCard('🎯 Captures', c.captures, null, 'text-green-400')
        + counterCard('🏅 Badges', c.badges, 'badges', 'text-yellow-400')
        + counterCard('🔁 Tentative', c.attempts, 'attempts', 'text-sky-400');
}

function changeCounter(key, delta) {
    const counters = { badges: 0, attempts: 1, ...currentState.counters };
    const min = key === 'attempts' ? 1 : 0;
    counters[key] = Math.max(min, Math.min(999, (Number(counters[key]) || min) + delta));
    currentState.counters = counters;
    commitState();
}

// --- LIEUX DE CAPTURE ---
function getAllPokemon() {
    return [...currentState.team, ...currentState.boxes.flat(), ...currentState.cemetery].filter(Boolean);
}

function renderRouteList() {
    const list = document.getElementById('route-list');
    if (!list) return;
    const routes = [...new Set(getAllPokemon().map(p => p.route).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    list.innerHTML = routes.map(r => `<option value="${escapeHtml(r)}"></option>`).join('');
}

function formatDeathDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date)) return '';
    return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// --- CAPTURE RAPIDE ---
function quickCapture(event) {
    event.preventDefault();
    const specInput = document.getElementById('q-spec');
    const frSpecies = specInput.value.trim();
    if (!frSpecies) {
        showToast("⚠️ Indiquez au moins l'espèce.", "error");
        specInput.focus();
        return;
    }
    const nickname = document.getElementById('q-nick').value.trim();
    const route = document.getElementById('q-route').value.trim();
    const sameRoute = route && getAllPokemon().find(p => p.route && p.route.toLowerCase() === route.toLowerCase());

    saveStateToHistory();
    const slot = placePokemon(currentState, {
        nickname: nickname || frSpecies,
        frSpecies,
        enSpecies: getEnName(frSpecies),
        gender: document.getElementById('q-gender').value,
        isShiny: document.getElementById('q-shiny').checked,
        level: document.getElementById('q-level').value,
        route
    });

    if (!slot) {
        stateHistory.pop();
        updateUndoButton();
        showToast("⚠️ L'équipe et toutes les boîtes sont pleines : ajoutez une boîte PC.", "error");
        return;
    }

    commitState();
    renderTeamForm();
    renderBoxGrid();
    renderBoxSlotPanel();

    const name = nickname || frSpecies;
    showToast(slot.type === 'team'
        ? `➕ ${name} rejoint l'équipe (slot ${slot.index + 1}) !`
        : `➕ ${name} envoyé dans la Boîte ${slot.boxIndex + 1} (slot ${slot.index + 1}).`);
    if (sameRoute) {
        showToast(`⚠️ Déjà une capture sur « ${route} » : ${sameRoute.nickname}.`, "error");
    }

    document.getElementById('quick-capture').reset();
    specInput.focus();
}

// --- RACCOURCIS CLAVIER ---
function isTypingTarget(el) {
    return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
}

function isModalOpen(id) {
    const modal = document.getElementById(id);
    return !!modal && !modal.classList.contains('hidden');
}

document.addEventListener('keydown', (e) => {
    const deathOpen = isModalOpen('death-details-modal');
    const configOpen = isModalOpen('config-modal');

    if (e.key === 'Escape') {
        if (deathOpen) closeDeathModal();
        else if (configOpen) closeConfigModal();
        else {
            document.getElementById('pc-search-results').classList.add('hidden');
            if (document.activeElement) document.activeElement.blur();
        }
        return;
    }
    if (deathOpen) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmDeathSend();
        }
        return;
    }
    if (configOpen) return;

    if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-6]$/.test(e.code)) {
        e.preventDefault();
        if (document.activeElement && document.activeElement.id && document.activeElement.id.startsWith('t-')) {
            document.activeElement.blur();
        }
        const index = Number(e.code.slice(5)) - 1;
        if (currentState.team[index]) triggerTeamDead(index);
        else showToast(`Slot d'équipe ${index + 1} vide.`, "error");
        return;
    }

    if (isTypingTarget(e.target)) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastAction();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '/') {
        e.preventDefault();
        document.getElementById('pc-search-input').focus();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        document.getElementById('q-spec').focus();
    }
});
