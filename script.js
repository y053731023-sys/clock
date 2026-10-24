let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let laps = [];
let isRunning = false;
let pauseCount = 0;

const timeDisplay = document.getElementById('time-display');
const startStopBtn = document.getElementById('start-stop-btn');
const lapResetBtn = document.getElementById('lap-reset-btn');
const lapsList = document.getElementById('laps-list');

function formatTime(ms) {
    const totalCentiseconds = Math.floor(ms / 10);
    const minutes = Math.floor(totalCentiseconds / 6000);
    const seconds = Math.floor((totalCentiseconds % 6000) / 100);
    const centiseconds = totalCentiseconds % 100;

    const pad = (num, length = 2) => num.toString().padStart(length, '0');
    
    return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}

function updateDisplay() {
    const currentElapsed = isRunning ? Date.now() - startTime + elapsedTime : elapsedTime;
    timeDisplay.textContent = formatTime(currentElapsed);
    
    if (lapsList.firstChild) {
        // Update current lap
        const currentLapItem = lapsList.firstChild;
        const previousTotal = laps.length > 0 ? laps[laps.length - 1].totalTime : 0;
        const currentLapTime = currentElapsed - previousTotal;
        currentLapItem.lastChild.textContent = formatTime(currentLapTime);
    }
}

function startStop() {
    if (isRunning) {
        // Stop
        isRunning = false;
        clearInterval(timerInterval);
        
        let finalElapsed = Date.now() - startTime + elapsedTime;
        
        if (typeof magicConfig !== 'undefined' && magicConfig.enabled) {
            if (magicConfig.mode === 'total' && magicConfig.totalForceMs !== null) {
                finalElapsed = magicConfig.totalForceMs;
            } else if (magicConfig.mode === 'sum' && magicConfig.sumForce !== null) {
                finalElapsed = applySumForce(finalElapsed, magicConfig.sumForce);
            } else if (magicConfig.mode === 'realtime') {
                const now = new Date();
                
                let offsetMins = magicConfig.rtOffset || 0;
                now.setMinutes(now.getMinutes() + offsetMins);
                
                let h24 = now.getHours();
                let h12 = h24 % 12;
                if (h12 === 0) h12 = 12;
                const mins = now.getMinutes();
                
                let targetH = magicConfig.rtFormat === '24' ? h24 : h12;
                
                const currentStopwatchMins = Math.floor(finalElapsed / 60000);
                const targetMs = (currentStopwatchMins * 60000) + (targetH * 1000) + (mins * 10);
                
                const diff = Math.abs(finalElapsed - targetMs);
                const toleranceMs = (magicConfig.rtTolerance !== undefined ? magicConfig.rtTolerance : 3) * 1000;
                
                // 接近真實時間才強制鎖定
                if (diff <= toleranceMs) {
                    finalElapsed = targetMs;
                }
            } else if (magicConfig.mode === 'pause_ms' && magicConfig.pauseMsList && magicConfig.pauseMsList.length > 0) {
                if (pauseCount < magicConfig.pauseMsList.length) {
                    const currentSeconds = Math.floor(finalElapsed / 1000);
                    const targetMs = magicConfig.pauseMsList[pauseCount];
                    finalElapsed = (currentSeconds * 1000) + (targetMs * 10);
                }
                pauseCount++;
            } else if (magicConfig.mode === 'deck' && deckTargetPos !== null) {
                const currentSeconds = Math.floor(finalElapsed / 1000);
                finalElapsed = (currentSeconds * 1000) + (deckTargetPos * 10);
            }
        }
        
        elapsedTime = finalElapsed;
        
        startStopBtn.textContent = '開始';
        startStopBtn.classList.remove('danger');
        lapResetBtn.textContent = '重置';
        updateDisplay();
    } else {
        // Start
        isRunning = true;
        startTime = Date.now();
        timerInterval = setInterval(updateDisplay, 10);
        startStopBtn.textContent = '停止';
        startStopBtn.classList.add('danger');
        lapResetBtn.textContent = '分圈';
        lapResetBtn.disabled = false;
        
        if (!lapsList.firstChild) {
            addLapItem(0, laps.length); // initial dummy lap
        }
    }
}

function lapReset() {
    if (isRunning) {
        // Lap
        const realElapsed = Date.now() - startTime + elapsedTime;
        const previousTotal = laps.length > 0 ? laps[laps.length - 1].totalTime : 0;
        let currentLapTime = realElapsed - previousTotal;
        let currentTotal = realElapsed;
        let lapTime = currentLapTime;
        
        laps.push({ time: lapTime, totalTime: currentTotal });
        
        if (lapsList.firstChild) {
            lapsList.firstChild.lastChild.textContent = formatTime(lapTime);
        }
        
        // Finalize previous lap item display
        if (laps.length > 1) {
            updateLapColors();
        }
        
        // Add new lap item at the top
        addLapItem(0, laps.length);
    } else {
        // Reset
        elapsedTime = 0;
        laps = [];
        updateDisplay();
        lapsList.innerHTML = '';
        lapResetBtn.disabled = true;
        lapResetBtn.textContent = '分圈';
    }
}

function addLapItem(time, index) {
    const li = document.createElement('li');
    li.className = 'lap-item';
    
    const lapNumSpan = document.createElement('span');
    lapNumSpan.textContent = `第${index + 1}圈`;
    
    const lapTimeSpan = document.createElement('span');
    lapTimeSpan.textContent = formatTime(time);
    
    li.appendChild(lapNumSpan);
    li.appendChild(lapTimeSpan);
    
    lapsList.insertBefore(li, lapsList.firstChild);
}

function updateLapColors() {
    if (laps.length < 2) return;
    
    const lapItems = Array.from(lapsList.children);
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    laps.forEach(lap => {
        if (lap.time < minTime) minTime = lap.time;
        if (lap.time > maxTime) maxTime = lap.time;
    });
    
    laps.forEach((lap, i) => {
        const domIndex = laps.length - 1 - i;
        const item = lapItems[domIndex];
        
        if (item) {
            item.className = 'lap-item';
            if (lap.time === minTime) item.classList.add('best');
            if (lap.time === maxTime) item.classList.add('worst');
        }
    });
}

startStopBtn.addEventListener('click', startStop);
lapResetBtn.addEventListener('click', lapReset);
lapResetBtn.disabled = true;

// --- Magic Backend Logic ---
let magicConfig = {
    enabled: false,
    mode: 'sum',
    sumForce: null,
    totalForceMs: null,
    rtOffset: 0,
    rtFormat: '12',
    rtTolerance: 3,
    pauseMsList: [],
    deck: null,
    deckPractice: false,
    swipeWindow: 3
};

// --- Deck (毫秒強選) ---
const DECK_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECK_SUITS = ['S', 'H', 'C', 'D'];
const SUIT_SYMBOL = { S: '♠', H: '♥', C: '♣', D: '♦' };

const DECK_PRESETS = {
    // Bicycle 新牌序：♠A-K, ♦A-K, ♣K-A, ♥K-A
    ndo: [
        ...DECK_VALUES.map(v => v + 'S'),
        ...DECK_VALUES.map(v => v + 'D'),
        ...[...DECK_VALUES].reverse().map(v => v + 'C'),
        ...[...DECK_VALUES].reverse().map(v => v + 'H')
    ],
    mnemonica: ('4C 2H 7D 3C 4H 6D AS 5H 9S 2S QH 3D QC 8H 6S 5S 9H KC 2D JH ' +
        '3S 8S 6H 10C 5D KD 2C 3H 8D 5C KS JD 8C 10S KH JC 7S 10H AD 4S ' +
        '7H 4D AC 9C JS QD 7C QS 10D 6C AH 9D').split(' ')
};

let deckTargetPos = null; // 1~52, session only
let deckDraft = [];
let deckSelectedIdx = 0;
let deckPendingValue = null;

function parseCardToken(tok) {
    const m = tok.trim().toUpperCase()
        .replace('♠', 'S').replace('♥', 'H').replace('♣', 'C').replace('♦', 'D')
        .match(/^(10|T|[2-9]|A|J|Q|K)([SHCD])$/);
    if (!m) return null;
    return (m[1] === 'T' ? '10' : m[1]) + m[2];
}

function cardLabel(code) {
    if (!code) return '—';
    return code.slice(0, -1) + SUIT_SYMBOL[code.slice(-1)];
}

try {
    const saved = localStorage.getItem('magicConfig');
    if (saved) {
        const parsed = JSON.parse(saved);
        magicConfig = parsed;
        if (!magicConfig.mode) magicConfig.mode = 'sum';
        if (!magicConfig.pauseMsList) magicConfig.pauseMsList = [];
    }
} catch(e) {}

if (!Array.isArray(magicConfig.deck) || magicConfig.deck.length !== 52) {
    magicConfig.deck = [...DECK_PRESETS.ndo];
}

const stopwatchTab = document.querySelector('.tab-item[data-target="view-stopwatch"]');
const magicModal = document.getElementById('magic-modal');
const magicSave = document.getElementById('magic-save');
const magicEnable = document.getElementById('magic-enable');

const magicMode = document.getElementById('magic-mode');
const sectionSum = document.getElementById('section-sum');
const sectionTotal = document.getElementById('section-total');
const sectionRealtime = document.getElementById('section-realtime');
const sectionPauseMs = document.getElementById('section-pause_ms');
const sectionDeck = document.getElementById('section-deck');

const forcePauseMsContainer = document.getElementById('force-pause-ms-container');
const magicAddPauseMs = document.getElementById('magic-add-pause-ms');
const magicRemovePauseMs = document.getElementById('magic-remove-pause-ms');

const forceSumInput = document.getElementById('force-sum');
const forceTotalMm = document.getElementById('force-total-mm');
const forceTotalSs = document.getElementById('force-total-ss');
const forceTotalCc = document.getElementById('force-total-cc');

const forceRtOffset = document.getElementById('force-rt-offset');
const forceRtFormat = document.getElementById('force-rt-format');
const forceRtTolerance = document.getElementById('force-rt-tolerance');

const updateSections = () => {
    if (!sectionSum) return;
    sectionSum.style.display = magicMode.value === 'sum' ? 'block' : 'none';
    sectionTotal.style.display = magicMode.value === 'total' ? 'block' : 'none';
    if (sectionRealtime) sectionRealtime.style.display = magicMode.value === 'realtime' ? 'block' : 'none';
    if (sectionPauseMs) sectionPauseMs.style.display = magicMode.value === 'pause_ms' ? 'block' : 'none';
    if (sectionDeck) sectionDeck.style.display = magicMode.value === 'deck' ? 'block' : 'none';
};

if (magicMode) {
    magicMode.addEventListener('change', updateSections);
}

const openMagic = () => {
    magicModal.classList.remove('hidden');
    magicEnable.checked = magicConfig.enabled;
    if (magicMode) {
        magicMode.value = magicConfig.mode;
        updateSections();
    }
    
    forceSumInput.value = magicConfig.sumForce !== null ? magicConfig.sumForce : '';
    
    if (magicConfig.totalForceMs !== null) {
        let t = magicConfig.totalForceMs;
        let cc = Math.floor((t % 1000) / 10);
        let ss = Math.floor((t / 1000) % 60);
        let mm = Math.floor(t / 60000);
        if (forceTotalMm) forceTotalMm.value = mm.toString().padStart(2, '0');
        if (forceTotalSs) forceTotalSs.value = ss.toString().padStart(2, '0');
        if (forceTotalCc) forceTotalCc.value = cc.toString().padStart(2, '0');
    } else {
        if (forceTotalMm) forceTotalMm.value = '';
        if (forceTotalSs) forceTotalSs.value = '';
        if (forceTotalCc) forceTotalCc.value = '';
    }
    
    if (forceRtOffset) forceRtOffset.value = magicConfig.rtOffset !== undefined ? magicConfig.rtOffset : 0;
    if (forceRtFormat) forceRtFormat.value = magicConfig.rtFormat !== undefined ? magicConfig.rtFormat : '12';
    if (forceRtTolerance) forceRtTolerance.value = magicConfig.rtTolerance !== undefined ? magicConfig.rtTolerance : 3;
    
    renderPauseMs();

    deckDraft = [...magicConfig.deck];
    deckSelectedIdx = 0;
    deckPendingValue = null;
    renderDeckEditor();
    const practiceToggle = document.getElementById('deck-practice');
    if (practiceToggle) practiceToggle.checked = !!magicConfig.deckPractice;
    const swipeWinInput = document.getElementById('deck-swipe-window');
    if (swipeWinInput) swipeWinInput.value = magicConfig.swipeWindow !== undefined ? magicConfig.swipeWindow : 3;
};

if (stopwatchTab) {
    let lastTapTime = 0;

    stopwatchTab.addEventListener('touchstart', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength > 0 && tapLength < 400) {
            openMagic();
            e.preventDefault();
        }
        lastTapTime = currentTime;
    });

    stopwatchTab.addEventListener('dblclick', (e) => {
        openMagic();
    });
    
    stopwatchTab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

function renderPauseMs() {
    if (!forcePauseMsContainer) return;
    forcePauseMsContainer.innerHTML = '';
    if (!magicConfig.pauseMsList || magicConfig.pauseMsList.length === 0) {
        magicConfig.pauseMsList = [0];
    }
    magicConfig.pauseMsList.forEach((cc, i) => {
        if (i > 0) {
            const div = document.createElement('div');
            div.className = 'lap-divider';
            div.textContent = '->';
            forcePauseMsContainer.appendChild(div);
        }
        
        const col = document.createElement('div');
        col.className = 'lap-item-col';
        
        const label = document.createElement('label');
        label.textContent = `第 ${i + 1} 次`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
        input.maxLength = 2;
        input.className = 'force-input-box pause-ms-input-cc';
        input.value = cc.toString().padStart(2, '0');
        input.placeholder = '00';
        
        col.appendChild(label);
        col.appendChild(input);
        forcePauseMsContainer.appendChild(col);
    });
}

const saveCurrentPauseMs = () => {
    const inputs = document.querySelectorAll('.pause-ms-input-cc');
    magicConfig.pauseMsList = Array.from(inputs).map(inp => parseInt(inp.value || 0, 10));
};

if (magicAddPauseMs) {
    magicAddPauseMs.onclick = () => {
        saveCurrentPauseMs();
        magicConfig.pauseMsList.push(0);
        renderPauseMs();
    };
}
if (magicRemovePauseMs) {
    magicRemovePauseMs.onclick = () => {
        saveCurrentPauseMs();
        if (magicConfig.pauseMsList.length > 1) {
            magicConfig.pauseMsList.pop();
        }
        renderPauseMs();
    };
}

if (magicSave) {
    magicSave.onclick = () => {
        if (!magicConfig.enabled && magicEnable.checked) {
            pauseCount = 0;
        }
        magicConfig.enabled = magicEnable.checked;
        if (magicMode) magicConfig.mode = magicMode.value;
        
        magicConfig.sumForce = (forceSumInput && forceSumInput.value !== '') ? parseInt(forceSumInput.value, 10) : null;
        
        if (forceTotalMm && forceTotalSs && forceTotalCc && (forceTotalMm.value !== '' || forceTotalSs.value !== '' || forceTotalCc.value !== '')) {
            let mm = parseInt(forceTotalMm.value || 0, 10);
            let ss = parseInt(forceTotalSs.value || 0, 10);
            let cc = parseInt(forceTotalCc.value || 0, 10);
            magicConfig.totalForceMs = (mm * 60000) + (ss * 1000) + (cc * 10);
        } else {
            magicConfig.totalForceMs = null;
        }
        
        magicConfig.rtOffset = (forceRtOffset && forceRtOffset.value !== '') ? parseInt(forceRtOffset.value, 10) : 0;
        magicConfig.rtFormat = forceRtFormat ? forceRtFormat.value : '12';
        magicConfig.rtTolerance = (forceRtTolerance && forceRtTolerance.value !== '') ? parseInt(forceRtTolerance.value, 10) : 3;
        
        saveCurrentPauseMs();
        magicConfig.deck = [...deckDraft];
        const practiceToggle = document.getElementById('deck-practice');
        if (practiceToggle) magicConfig.deckPractice = practiceToggle.checked;
        const swipeWinInput = document.getElementById('deck-swipe-window');
        if (swipeWinInput) magicConfig.swipeWindow = parseFloat(swipeWinInput.value) || 3;
        
        localStorage.setItem('magicConfig', JSON.stringify(magicConfig));
        magicModal.classList.add('hidden');
        if (typeof updateIndicatorDots === 'function') updateIndicatorDots();
        if (typeof setPracticeVisible === 'function') setPracticeVisible();
    };
}

function applySumForce(realMs, forceSum) {
    let totalSeconds = Math.floor(realMs / 1000);
    if (totalSeconds >= forceSum) {
        return realMs;
    }

    let baseMins = Math.floor(realMs / 60000);
    let s = Math.floor((realMs % 60000) / 1000);
    let cc = forceSum - s;
    
    if (cc < 0) cc = 0;
    if (cc > 99) cc = 99;
    
    return (baseMins * 60000) + (s * 1000) + (cc * 10);
}

// --- Deck Editor ---
const deckGrid = document.getElementById('deck-grid');
const deckStatus = document.getElementById('deck-status');
const deckKeypadValues = document.getElementById('deck-keypad-values');
const deckKeypadSuits = document.getElementById('deck-keypad-suits');
const deckImportToggle = document.getElementById('deck-import-toggle');
const deckImportBox = document.getElementById('deck-import-box');
const deckImportText = document.getElementById('deck-import-text');
const deckImportApply = document.getElementById('deck-import-apply');

function renderDeckEditor() {
    if (!deckGrid) return;

    const counts = {};
    deckDraft.forEach(c => { if (c) counts[c] = (counts[c] || 0) + 1; });

    deckGrid.innerHTML = '';
    deckDraft.forEach((code, i) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'deck-cell';
        if (i === deckSelectedIdx) cell.classList.add('selected');
        if (code && counts[code] > 1) cell.classList.add('dup');
        if (code && (code.endsWith('H') || code.endsWith('D'))) cell.classList.add('red');

        const num = document.createElement('span');
        num.className = 'deck-cell-num';
        num.textContent = i + 1;

        const card = document.createElement('span');
        card.className = 'deck-cell-card';
        card.textContent = (i === deckSelectedIdx && deckPendingValue) ? deckPendingValue + '?' : cardLabel(code);

        cell.appendChild(num);
        cell.appendChild(card);
        cell.onclick = () => {
            deckSelectedIdx = i;
            deckPendingValue = null;
            renderDeckEditor();
        };
        deckGrid.appendChild(cell);
    });

    const dupCount = Object.values(counts).filter(n => n > 1).length;
    const missing = DECK_VALUES.length * DECK_SUITS.length -
        Object.keys(counts).length;
    if (deckStatus) {
        deckStatus.textContent = (dupCount === 0 && missing === 0)
            ? '✓ 52 張完整無重複'
            : `⚠ 重複 ${dupCount} 種 / 缺 ${missing} 張（重複時取最前面位置）`;
        deckStatus.classList.toggle('warn', dupCount > 0 || missing > 0);
    }

    if (deckKeypadValues && !deckKeypadValues.childElementCount) {
        DECK_VALUES.forEach(v => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'deck-key';
            b.textContent = v;
            b.onclick = () => {
                deckPendingValue = v;
                renderDeckEditor();
            };
            deckKeypadValues.appendChild(b);
        });
        DECK_SUITS.forEach(s => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'deck-key suit' + (s === 'H' || s === 'D' ? ' red' : '');
            b.textContent = SUIT_SYMBOL[s];
            b.onclick = () => {
                if (!deckPendingValue) return;
                deckDraft[deckSelectedIdx] = deckPendingValue + s;
                deckPendingValue = null;
                if (deckSelectedIdx < 51) deckSelectedIdx++;
                renderDeckEditor();
                const sel = deckGrid.querySelector('.deck-cell.selected');
                if (sel) sel.scrollIntoView({ block: 'nearest' });
            };
            deckKeypadSuits.appendChild(b);
        });
    }

    if (deckKeypadValues) {
        Array.from(deckKeypadValues.children).forEach(b =>
            b.classList.toggle('active', b.textContent === deckPendingValue));
    }
}

document.querySelectorAll('.deck-preset-btn[data-preset]').forEach(btn => {
    btn.onclick = () => {
        deckDraft = [...DECK_PRESETS[btn.dataset.preset]];
        deckSelectedIdx = 0;
        deckPendingValue = null;
        renderDeckEditor();
    };
});

if (deckImportToggle) {
    deckImportToggle.onclick = () => {
        deckImportBox.classList.toggle('hidden');
        if (!deckImportBox.classList.contains('hidden')) {
            deckImportText.value = deckDraft.join(' ');
        }
    };
}

if (deckImportApply) {
    deckImportApply.onclick = () => {
        const tokens = deckImportText.value.split(/[\s,，]+/).filter(Boolean);
        const parsed = tokens.map(parseCardToken);
        const badIdx = parsed.findIndex(c => c === null);
        if (badIdx !== -1) {
            alert(`第 ${badIdx + 1} 個無法解析：${tokens[badIdx]}`);
            return;
        }
        if (parsed.length !== 52) {
            alert(`需要 52 張，目前 ${parsed.length} 張`);
            return;
        }
        deckDraft = parsed;
        deckImportBox.classList.add('hidden');
        renderDeckEditor();
    };
}

// --- Deck Secret Input: Swipe Panel ---
// 第 1 滑 = 花色：↑♠ →♥ ↓♣ ←♦
// 之後 = 點數（二進位加總）：↑1 →2 ↓4 ←8，同方向重複只算一次
// 從第 1 滑起算 swipeWindow 秒後自動結算；中途點一下 = 立即結算
// 只滑花色（點數 0）= 清除目標；總和 > 13 = 無效
const swipePanel = document.getElementById('swipe-panel');
const swipeLegend = document.getElementById('swipe-legend');
const swipeReadout = document.getElementById('swipe-readout');
const swipeCountdownBar = document.getElementById('swipe-countdown-bar');

const DIR_SUIT = { U: 'S', R: 'H', D: 'C', L: 'D' };
const DIR_BIT = { U: 1, R: 2, D: 4, L: 8 };
const DIR_ARROW = { U: '↑', R: '→', D: '↓', L: '←' };
const SWIPE_MIN_DIST = 30;
const TAP_MAX_DIST = 10;

let swipeSeq = null; // { suit, bits:Set, dirs:[] }
let swipeCommitTimer = null;
let swipeStart = null;
let lastSwipeAt = 0;

function getSwipeWindowMs() {
    const s = parseFloat(magicConfig.swipeWindow);
    return (isNaN(s) || s <= 0 ? 3 : s) * 1000;
}

function isDeckActive() {
    const swView = document.getElementById('view-stopwatch');
    const isStopwatch = swView ? swView.classList.contains('active') : true;
    return isStopwatch && magicConfig.enabled && magicConfig.mode === 'deck';
}

function swipeValue(seq) {
    let v = 0;
    seq.bits.forEach(d => { v += DIR_BIT[d]; });
    return v;
}

function flashIndicator(times) {
    const dots = document.querySelectorAll('.page-indicators .dot');
    const dot = dots[1];
    if (!dot) return;
    let n = 0;
    const blink = () => {
        dot.classList.add('flash');
        setTimeout(() => {
            dot.classList.remove('flash');
            if (++n < times) setTimeout(blink, 180);
        }, 180);
    };
    blink();
}

function commitSwipe() {
    clearTimeout(swipeCommitTimer);
    const seq = swipeSeq;
    swipeSeq = null;
    if (!seq) return;

    const value = swipeValue(seq);
    if (value === 0) {
        deckTargetPos = null;
        flashIndicator(3);
        practiceOnClear();
        return;
    }
    if (value > 13) {
        flashIndicator(2);
        practiceOnInvalid(seq, value);
        return;
    }
    const code = DECK_VALUES[value - 1] + seq.suit;
    const pos = magicConfig.deck.indexOf(code);
    if (pos === -1) {
        flashIndicator(2);
        practiceOnResult(code, -1);
        return;
    }
    deckTargetPos = pos + 1;
    flashIndicator(1);
    practiceOnResult(code, pos + 1);
}

function handleSwipe(dir) {
    lastSwipeAt = Date.now();
    if (!swipeSeq) {
        swipeSeq = { suit: DIR_SUIT[dir], bits: new Set(), dirs: [dir] };
        clearTimeout(swipeCommitTimer);
        swipeCommitTimer = setTimeout(commitSwipe, getSwipeWindowMs());
        practiceOnSwipe(true);
        return;
    }
    swipeSeq.dirs.push(dir);
    swipeSeq.bits.add(dir);
    practiceOnSwipe(false);
}

function updateSwipePanel() {
    if (swipePanel) swipePanel.classList.toggle('active', isDeckActive());
}

if (swipePanel) {
    swipePanel.addEventListener('pointerdown', (e) => {
        if (!isDeckActive()) return;
        e.preventDefault();
        swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
        try { swipePanel.setPointerCapture(e.pointerId); } catch (err) {}
    });

    swipePanel.addEventListener('pointerup', (e) => {
        if (!swipeStart || e.pointerId !== swipeStart.id) return;
        const dx = e.clientX - swipeStart.x;
        const dy = e.clientY - swipeStart.y;
        swipeStart = null;
        const dist = Math.hypot(dx, dy);

        if (dist <= TAP_MAX_DIST) {
            if (swipeSeq) commitSwipe(); // tap = commit now
            return;
        }
        if (dist < SWIPE_MIN_DIST) return;

        const dir = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'R' : 'L')
            : (dy > 0 ? 'D' : 'U');
        handleSwipe(dir);
    });

    swipePanel.addEventListener('pointercancel', () => { swipeStart = null; });
    swipePanel.addEventListener('contextmenu', (e) => e.preventDefault());
}

updateSwipePanel();

// --- Deck Practice Mode ---
const practiceHud = document.getElementById('practice-hud');
const practicePrompt = document.getElementById('practice-prompt');
const practiceStats = document.getElementById('practice-stats');
const practiceQuizBtn = document.getElementById('practice-quiz');
const practiceHintBtn = document.getElementById('practice-hint');
const practiceExitBtn = document.getElementById('practice-exit');
const deckPracticeToggle = document.getElementById('deck-practice');

const HINT_LEVELS = [
    { cls: 'hint-full', label: '提示：全' },
    { cls: 'hint-frame', label: '提示：外框' },
    { cls: 'hint-none', label: '提示：無' }
];
let practiceHintLevel = 0;
let practiceQuiz = false;
let practiceTarget = null;
let practiceTargetAt = 0;
let practiceNextTimer = null;
const practiceScore = { total: 0, correct: 0, streak: 0, best: 0, times: [] };

function isPracticeOn() {
    return isDeckActive() && !!magicConfig.deckPractice;
}

function legendCell(pos, dir, text, cls = '') {
    return `<div class="sg-cell sg-${pos} ${cls}">${DIR_ARROW[dir]} ${text}</div>`;
}

function renderSwipeLegend() {
    if (!swipeLegend) return;
    const posOf = { U: 'up', R: 'right', D: 'down', L: 'left' };
    let html = '';
    if (!swipeSeq) {
        Object.keys(DIR_SUIT).forEach(d => {
            const s = DIR_SUIT[d];
            html += legendCell(posOf[d], d, SUIT_SYMBOL[s], (s === 'H' || s === 'D') ? 'red' : '');
        });
        html += '<div class="sg-cell sg-center">花色</div>';
    } else {
        Object.keys(DIR_BIT).forEach(d => {
            html += legendCell(posOf[d], d, DIR_BIT[d], swipeSeq.bits.has(d) ? 'used' : '');
        });
        html += `<div class="sg-cell sg-center">${SUIT_SYMBOL[swipeSeq.suit]}</div>`;
    }
    swipeLegend.innerHTML = html;
}

function renderSwipeReadout() {
    if (!swipeReadout) return;
    if (!swipeSeq) {
        swipeReadout.innerHTML = '';
        return;
    }
    const parts = ['U', 'R', 'D', 'L'].filter(d => swipeSeq.bits.has(d)).map(d => DIR_BIT[d]);
    const v = swipeValue(swipeSeq);
    const valText = v === 0 ? '（清除）' : v > 13 ? `${v}（無效）` : DECK_VALUES[v - 1];
    swipeReadout.innerHTML = `${cardHtml('A' + swipeSeq.suit).replace('A', '')} ${parts.join('+') || '0'} = ${valText}`;
}

function restartCountdown() {
    if (!swipeCountdownBar) return;
    swipeCountdownBar.style.transition = 'none';
    swipeCountdownBar.style.width = '100%';
    void swipeCountdownBar.offsetWidth;
    swipeCountdownBar.style.transition = `width ${getSwipeWindowMs()}ms linear`;
    swipeCountdownBar.style.width = '0%';
}

function stopCountdown() {
    if (!swipeCountdownBar) return;
    swipeCountdownBar.style.transition = 'none';
    swipeCountdownBar.style.width = '0%';
}

function setPracticeVisible() {
    const on = isPracticeOn();
    updateSwipePanel();
    if (practiceHud) practiceHud.classList.toggle('hidden', !on);
    if (swipePanel) {
        swipePanel.classList.toggle('practice', on);
        HINT_LEVELS.forEach(h => swipePanel.classList.remove(h.cls));
        if (on) {
            swipePanel.classList.add(HINT_LEVELS[practiceHintLevel].cls);
        }
    }
    if (practiceHintBtn) practiceHintBtn.textContent = HINT_LEVELS[practiceHintLevel].label;
    if (practiceQuizBtn) practiceQuizBtn.classList.toggle('active', practiceQuiz);
    if (on) {
        renderSwipeLegend();
        renderSwipeReadout();
        renderPracticeStats();
        if (!practiceQuiz && !swipeSeq) setPrompt('自由練習：在下方面板滑動輸入');
    } else {
        if (swipeLegend) swipeLegend.innerHTML = '';
        if (swipeReadout) swipeReadout.innerHTML = '';
        stopCountdown();
    }
}

function setPrompt(html, cls = '') {
    if (!practicePrompt) return;
    practicePrompt.innerHTML = html;
    practicePrompt.className = 'practice-prompt' + (cls ? ' ' + cls : '');
}

function cardHtml(code) {
    const red = code.endsWith('H') || code.endsWith('D');
    return `<span class="${red ? 'pc-red' : ''}">${cardLabel(code)}</span>`;
}

function renderPracticeStats() {
    if (!practiceStats) return;
    if (!practiceQuiz) {
        practiceStats.textContent = deckTargetPos !== null ? `目前目標：.${String(deckTargetPos).padStart(2, '0')}` : '';
        return;
    }
    const s = practiceScore;
    const avg = s.times.length ? (s.times.reduce((a, b) => a + b, 0) / s.times.length / 1000).toFixed(2) : '-';
    const rate = s.total ? Math.round((s.correct / s.total) * 100) : 0;
    practiceStats.textContent = `${s.correct}/${s.total} (${rate}%) · 連對 ${s.streak} · 最佳 ${s.best} · 平均 ${avg}s`;
}

function nextQuizCard() {
    const pool = magicConfig.deck.filter(Boolean);
    let next;
    do {
        next = pool[Math.floor(Math.random() * pool.length)];
    } while (pool.length > 1 && next === practiceTarget);
    practiceTarget = next;
    practiceTargetAt = Date.now();
    setPrompt(`請輸入 ${cardHtml(next)}`);
}

function practiceOnSwipe(isFirst) {
    if (!isPracticeOn()) return;
    if (isFirst) restartCountdown();
    renderSwipeLegend();
    renderSwipeReadout();
    if (swipePanel) {
        swipePanel.classList.remove('hit');
        void swipePanel.offsetWidth;
        swipePanel.classList.add('hit');
    }
}

function practiceAfterCommit() {
    stopCountdown();
    renderSwipeLegend();
    renderSwipeReadout();
}

function practiceOnClear() {
    if (!isPracticeOn()) return;
    practiceAfterCommit();
    setPrompt('已清除目標（只滑了花色）');
    renderPracticeStats();
}

function practiceScoreWrong(msg) {
    practiceScore.total++;
    practiceScore.streak = 0;
    setPrompt(msg, 'bad');
    renderPracticeStats();
    clearTimeout(practiceNextTimer);
    practiceNextTimer = setTimeout(() => practiceQuiz && nextQuizCard(), 1500);
}

function practiceOnInvalid(seq, value) {
    if (!isPracticeOn()) return;
    practiceAfterCommit();
    const msg = `✗ 點數 ${value} 超過 13（${seq.dirs.map(d => DIR_ARROW[d]).join(' ')}）`;
    if (practiceQuiz) {
        practiceScoreWrong(`${msg}，應為 ${cardHtml(practiceTarget)}`);
    } else {
        setPrompt(msg, 'bad');
    }
}

function practiceOnResult(code, pos) {
    if (!isPracticeOn()) return;
    practiceAfterCommit();
    clearTimeout(practiceNextTimer);

    const posText = pos === -1 ? '不在牌組' : `第 ${pos} 張 → .${String(pos).padStart(2, '0')}`;

    if (!practiceQuiz) {
        setPrompt(`${cardHtml(code)}　${posText}`, pos === -1 ? 'bad' : 'good');
        renderPracticeStats();
        return;
    }

    if (code !== practiceTarget) {
        practiceScoreWrong(`✗ 輸入 ${cardHtml(code)}，應為 ${cardHtml(practiceTarget)}`);
        return;
    }

    const s = practiceScore;
    const elapsed = lastSwipeAt - practiceTargetAt; // 到最後一滑為止，不含等待結算
    s.total++;
    s.correct++;
    s.streak++;
    s.best = Math.max(s.best, s.streak);
    s.times.push(elapsed);
    if (s.times.length > 20) s.times.shift();
    setPrompt(`✓ ${cardHtml(code)}　${(elapsed / 1000).toFixed(2)}s　${posText}`, 'good');
    renderPracticeStats();
    practiceNextTimer = setTimeout(() => practiceQuiz && nextQuizCard(), 700);
}

if (practiceQuizBtn) {
    practiceQuizBtn.onclick = () => {
        practiceQuiz = !practiceQuiz;
        clearTimeout(practiceNextTimer);
        clearTimeout(swipeCommitTimer);
        swipeSeq = null;
        stopCountdown();
        if (practiceQuiz) {
            Object.assign(practiceScore, { total: 0, correct: 0, streak: 0, best: 0, times: [] });
        }
        setPracticeVisible();
        if (practiceQuiz) nextQuizCard();
    };
}

if (practiceHintBtn) {
    practiceHintBtn.onclick = () => {
        practiceHintLevel = (practiceHintLevel + 1) % HINT_LEVELS.length;
        setPracticeVisible();
    };
}

if (practiceExitBtn) {
    practiceExitBtn.onclick = () => {
        magicConfig.deckPractice = false;
        practiceQuiz = false;
        clearTimeout(practiceNextTimer);
        localStorage.setItem('magicConfig', JSON.stringify(magicConfig));
        if (deckPracticeToggle) deckPracticeToggle.checked = false;
        setPracticeVisible();
    };
}

setPracticeVisible();

// --- Hidden Magic Trigger on Page Indicators ---
const pageIndicators = document.querySelector('.page-indicators');

function updateIndicatorDots() {
    if (!pageIndicators) return;
    const dots = pageIndicators.querySelectorAll('.dot');
    if (dots.length >= 2) {
        if (magicConfig.enabled) {
            dots[0].classList.remove('active');
            dots[1].classList.add('active');
        } else {
            dots[0].classList.add('active');
            dots[1].classList.remove('active');
        }
    }
}

if (pageIndicators) {
    updateIndicatorDots();
    pageIndicators.addEventListener('click', () => {
        magicConfig.enabled = !magicConfig.enabled;
        if (magicConfig.enabled) {
            pauseCount = 0;
        }
        localStorage.setItem('magicConfig', JSON.stringify(magicConfig));
        updateIndicatorDots();
        if (magicEnable) magicEnable.checked = magicConfig.enabled;
        setPracticeVisible();
    });
}

// --- Bottom Tab Bar Sliding Logic ---
const tabItems = document.querySelectorAll('.tab-item');
const tabIndicator = document.getElementById('active-tab-indicator');

function updateTabIndicator(activeTab) {
    if (!activeTab || !tabIndicator) return;
    
    const tabLeft = activeTab.offsetLeft;
    const tabWidth = activeTab.offsetWidth;
    
    tabIndicator.style.width = `${tabWidth}px`;
    tabIndicator.style.transform = `translateX(${tabLeft}px)`;
}

// Initialize position
let activeTab = document.querySelector('.tab-item.active');
if (activeTab) {
    // Small delay to ensure layout is complete
    setTimeout(() => updateTabIndicator(activeTab), 50);
}

// Add click listeners to tabs
const views = document.querySelectorAll('.view');
tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
        tabItems.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        updateTabIndicator(tab);
        
        const targetId = tab.getAttribute('data-target');
        if (targetId) {
            views.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById(targetId);
            if (targetView) targetView.classList.add('active');
            if (typeof updateSwipePanel === 'function') updateSwipePanel();
        }
    });
});

// --- Timer Picker Scroll Logic ---
const pickerColumns = document.querySelectorAll('.picker-column');

pickerColumns.forEach(column => {
    // Add spacer divs to fix iOS scroll snapping
    const topSpacer = document.createElement('div');
    topSpacer.className = 'picker-spacer';
    const bottomSpacer = document.createElement('div');
    bottomSpacer.className = 'picker-spacer';
    
    column.insertBefore(topSpacer, column.firstChild);
    column.appendChild(bottomSpacer);

    const updateSelected = () => {
        const columnRect = column.getBoundingClientRect();
        const centerY = columnRect.top + columnRect.height / 2;
        
        let closestItem = null;
        let minDistance = Infinity;

        // Only check actual picker items, not spacers
        const items = column.querySelectorAll('.picker-item');
        items.forEach(item => {
            const itemRect = item.getBoundingClientRect();
            const itemCenterY = itemRect.top + itemRect.height / 2;
            const distance = Math.abs(itemCenterY - centerY);

            if (distance < minDistance) {
                minDistance = distance;
                closestItem = item;
            }
        });

        items.forEach(item => {
            item.classList.remove('selected');
            item.classList.add('dimmed');
        });
        if (closestItem) {
            closestItem.classList.add('selected');
            closestItem.classList.remove('dimmed');
        }
    };

    column.addEventListener('scroll', updateSelected);
    // Call once to initialize correctly and set scroll position
    setTimeout(() => {
        updateSelected();
        const initialSelected = column.querySelector('.picker-item.selected');
        if (initialSelected) {
            // Force the scroll position to align the selected item in the center
            const containerCenter = column.clientHeight / 2;
            const itemCenter = initialSelected.offsetTop + (initialSelected.offsetHeight / 2);
            column.scrollTop = itemCenter - containerCenter;
        }
    }, 50);
});

window.addEventListener('resize', () => {
    activeTab = document.querySelector('.tab-item.active');
    updateTabIndicator(activeTab);
});

// --- Drag Gesture on Tab Bar ---
const tabBar = document.getElementById('tab-bar');

if (tabBar) {
    tabBar.addEventListener('touchmove', (e) => {
        // Prevent default scrolling when dragging on the tab bar
        e.preventDefault();
        
        const touch = e.touches[0];
        const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (elementUnderFinger) {
            const tabItem = elementUnderFinger.closest('.tab-item');
            if (tabItem && !tabItem.classList.contains('active')) {
                tabItems.forEach(t => t.classList.remove('active'));
                tabItem.classList.add('active');
                updateTabIndicator(tabItem);
                
                const targetId = tabItem.getAttribute('data-target');
                if (targetId) {
                    views.forEach(v => v.classList.remove('active'));
                    const targetView = document.getElementById(targetId);
                    if (targetView) targetView.classList.add('active');
                    if (typeof updateSwipePanel === 'function') updateSwipePanel();
                }
            }
        }
    }, { passive: false });
}
