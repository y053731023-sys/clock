let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let laps = [];
let isRunning = false;

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

        if (typeof magicConfig !== 'undefined' && magicConfig.enabled && magicConfig.mode === 'laps' && magicConfig.dynamicLaps && laps.length < magicConfig.dynamicLaps.length) {
            const targetCC = magicConfig.dynamicLaps[laps.length];
            const currentSeconds = Math.floor(currentLapTime / 1000);
            let forcedLapTime = (currentSeconds * 1000) + (targetCC * 10);
            
            if (forcedLapTime < currentLapTime) {
                forcedLapTime += 1000;
            }
            
            const forcedElapsed = previousTotal + forcedLapTime;
            const diff = realElapsed - forcedElapsed;
            
            startTime += diff;
            
            currentTotal = Date.now() - startTime + elapsedTime;
            lapTime = forcedLapTime;
        }
        
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
    dynamicLaps: [],
    rtOffset: 0,
    rtFormat: '12',
    rtTolerance: 3
};

try {
    const saved = localStorage.getItem('magicConfig');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.dynamicLaps)) {
            magicConfig = parsed;
            if (!magicConfig.mode) magicConfig.mode = 'sum';
        } else {
            localStorage.removeItem('magicConfig');
        }
    }
} catch(e) {}

const stopwatchTab = document.querySelector('.tab-item[data-target="view-stopwatch"]');
const magicModal = document.getElementById('magic-modal');
const magicClose = document.getElementById('magic-close');
const magicSave = document.getElementById('magic-save');
const magicEnable = document.getElementById('magic-enable');

const magicMode = document.getElementById('magic-mode');
const sectionSum = document.getElementById('section-sum');
const sectionTotal = document.getElementById('section-total');
const sectionLaps = document.getElementById('section-laps');
const sectionRealtime = document.getElementById('section-realtime');

const forceSumInput = document.getElementById('force-sum');
const forceTotalMm = document.getElementById('force-total-mm');
const forceTotalSs = document.getElementById('force-total-ss');
const forceTotalCc = document.getElementById('force-total-cc');
const forceLapsContainer = document.getElementById('force-laps-container');
const magicAddLap = document.getElementById('magic-add-lap');
const magicRemoveLap = document.getElementById('magic-remove-lap');

const forceRtOffset = document.getElementById('force-rt-offset');
const forceRtFormat = document.getElementById('force-rt-format');
const forceRtTolerance = document.getElementById('force-rt-tolerance');

const updateSections = () => {
    if (!sectionSum) return;
    sectionSum.style.display = magicMode.value === 'sum' ? 'block' : 'none';
    sectionTotal.style.display = magicMode.value === 'total' ? 'block' : 'none';
    sectionLaps.style.display = magicMode.value === 'laps' ? 'block' : 'none';
    if (sectionRealtime) sectionRealtime.style.display = magicMode.value === 'realtime' ? 'block' : 'none';
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
    
    renderLaps();
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

function renderLaps() {
    if (!forceLapsContainer) return;
    forceLapsContainer.innerHTML = '';
    magicConfig.dynamicLaps.forEach((cc, i) => {
        if (i > 0) {
            const div = document.createElement('div');
            div.className = 'lap-divider';
            div.textContent = '-';
            forceLapsContainer.appendChild(div);
        }
        
        const col = document.createElement('div');
        col.className = 'lap-item-col';
        
        const label = document.createElement('label');
        label.textContent = `Lap ${i + 1}`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
        input.maxLength = 2;
        input.className = 'force-input-box lap-input-cc';
        input.value = cc.toString().padStart(2, '0');
        input.placeholder = '00';
        
        col.appendChild(label);
        col.appendChild(input);
        forceLapsContainer.appendChild(col);
    });
}

const saveCurrentLaps = () => {
    const lapInputs = document.querySelectorAll('.lap-input-cc');
    magicConfig.dynamicLaps = Array.from(lapInputs).map(inp => parseInt(inp.value || 0, 10));
};

if (magicAddLap) {
    magicAddLap.onclick = () => {
        saveCurrentLaps();
        magicConfig.dynamicLaps.push(0);
        renderLaps();
    };
}
if (magicRemoveLap) {
    magicRemoveLap.onclick = () => {
        saveCurrentLaps();
        magicConfig.dynamicLaps.pop();
        renderLaps();
    };
}
if (magicClose) magicClose.onclick = () => magicModal.classList.add('hidden');

if (magicSave) {
    magicSave.onclick = () => {
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
        
        saveCurrentLaps();
        
        localStorage.setItem('magicConfig', JSON.stringify(magicConfig));
        magicModal.classList.add('hidden');
    };
}

function applySumForce(realMs, forceSum) {
    let bestTime = realMs;
    let minDiff = Infinity;
    let baseMins = Math.floor(realMs / 60000);
    
    for (let m = baseMins; m <= baseMins + 1; m++) {
        for (let s = 0; s < 60; s++) {
            let cc = forceSum - s;
            if (cc >= 0 && cc <= 99) {
                let candidateMs = (m * 60000) + (s * 1000) + (cc * 10);
                let diff = candidateMs - realMs;
                if (diff >= 0 && diff < minDiff) {
                    minDiff = diff;
                    bestTime = candidateMs;
                }
            }
        }
    }
    return bestTime;
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
                }
            }
        }
    }, { passive: false });
}
