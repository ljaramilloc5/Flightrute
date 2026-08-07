// Authentic sequence of characters on a mechanical wheel
const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";
const STORAGE_KEY = 'flight-widget-state';
const CHANNEL_NAME = 'flight-widget-channel';
const DEFAULT_DATA = {
    origin: 'MMSD',
    dest: 'MMTO',
    callsign: 'VOI551',
    airplane: 'A320'
};

const boardConfig = {
    'board-origin': { length: 4 },
    'board-dest': { length: 4 },
    'widget-origin': { length: 4 },
    'widget-dest': { length: 4 }
};

function buildBoard(boardId) {
    const container = document.getElementById(boardId);
    if (!container) return;

    container.innerHTML = '';

    for (let i = 0; i < boardConfig[boardId].length; i++) {
        const flap = document.createElement('div');
        flap.className = 'flap-character';
        flap.dataset.char = ' ';

        const textSpan = document.createElement('span');
        textSpan.className = 'flap-text';
        textSpan.textContent = ' ';

        flap.appendChild(textSpan);
        container.appendChild(flap);
    }
}

function buildBoards() {
    Object.keys(boardConfig).forEach(buildBoard);
}

function flipCharacter(flapElement, targetChar) {
    targetChar = targetChar.toUpperCase();
    if (!CHARS.includes(targetChar)) targetChar = ' ';

    const currentChar = flapElement.dataset.char;
    if (currentChar === targetChar) return;

    let currentIdx = CHARS.indexOf(currentChar);
    let targetIdx = CHARS.indexOf(targetChar);

    let flipsNeeded = targetIdx - currentIdx;
    if (flipsNeeded < 0) flipsNeeded += CHARS.length;

    let currentFlip = 0;

    flapElement.classList.remove('animating');

    const tickInterval = setInterval(() => {
        currentFlip++;
        currentIdx = (currentIdx + 1) % CHARS.length;
        const nextChar = CHARS[currentIdx];

        flapElement.classList.remove('animating');
        void flapElement.offsetWidth;
        flapElement.classList.add('animating');

        flapElement.querySelector('.flap-text').textContent = nextChar;
        flapElement.dataset.char = nextChar;

        if (currentFlip >= flipsNeeded) {
            clearInterval(tickInterval);
            setTimeout(() => flapElement.classList.remove('animating'), 100);
        }
    }, 60);
}

function animateBoardGroup(targetStr, boardId) {
    const board = document.getElementById(boardId);
    if (!board) return;

    const flaps = board.querySelectorAll('.flap-character');
    const paddedTarget = String(targetStr || '').padEnd(flaps.length, ' ');

    flaps.forEach((flap, index) => {
        setTimeout(() => {
            flipCharacter(flap, paddedTarget[index] ?? ' ');
        }, index * 80);
    });
}

function setDisplayValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
}

function readStoredData() {
    try {
        const storedValue = localStorage.getItem(STORAGE_KEY);
        return storedValue ? JSON.parse(storedValue) : null;
    } catch (error) {
        return null;
    }
}

function persistData(data) {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);

    if (window.broadcastChannel) {
        window.broadcastChannel.postMessage({ type: 'sync', payload: data });
    }
}

function renderFlightData({ origin, dest, callsign, airplane }) {
    const safeOrigin = String(origin || '').trim().toUpperCase().substring(0, 4);
    const safeDest = String(dest || '').trim().toUpperCase().substring(0, 4);
    const safeCallsign = String(callsign || '').trim().toUpperCase();
    const safeAirplane = String(airplane || '').trim().toUpperCase();

    animateBoardGroup(safeOrigin, 'board-origin');
    animateBoardGroup(safeDest, 'board-dest');
    animateBoardGroup(safeOrigin, 'widget-origin');
    animateBoardGroup(safeDest, 'widget-dest');

    setDisplayValue('display-callsign', safeCallsign || '---');
    setDisplayValue('display-airplane', safeAirplane || '---');
    setDisplayValue('widget-callsign', safeCallsign || '---');
    setDisplayValue('widget-airplane', safeAirplane || '---');
}

function clearInputs() {
    ['input-origin', 'input-dest', 'input-callsign', 'input-airplane'].forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (input) input.value = '';
    });
}

function updateBoard() {
    const originInput = document.getElementById('input-origin');
    const destInput = document.getElementById('input-dest');
    const callsignInput = document.getElementById('input-callsign');
    const airplaneInput = document.getElementById('input-airplane');

    const newOrigin = originInput ? originInput.value.trim().toUpperCase().substring(0, 4) : '';
    const newDest = destInput ? destInput.value.trim().toUpperCase().substring(0, 4) : '';
    const newCallsign = callsignInput ? callsignInput.value.trim().toUpperCase() : '';
    const newAirplane = airplaneInput ? airplaneInput.value.trim().toUpperCase() : '';

    const data = {
        origin: newOrigin,
        dest: newDest,
        callsign: newCallsign,
        airplane: newAirplane
    };

    persistData(data);
    renderFlightData(data);

    clearInputs();
}

function bindInputs() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach((input) => {
        input.addEventListener('input', function () {
            this.value = this.value.toUpperCase();
        });

        input.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                updateBoard();
            }
        });
    });
}

function applyInitialState() {
    const storedData = readStoredData() || DEFAULT_DATA;

    const originInput = document.getElementById('input-origin');
    const destInput = document.getElementById('input-dest');
    const callsignInput = document.getElementById('input-callsign');
    const airplaneInput = document.getElementById('input-airplane');

    if (originInput) originInput.value = storedData.origin;
    if (destInput) destInput.value = storedData.dest;
    if (callsignInput) callsignInput.value = storedData.callsign;
    if (airplaneInput) airplaneInput.value = storedData.airplane;

    renderFlightData(storedData);
    clearInputs();
}

function handleStorageSync(event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;

    try {
        const incomingData = JSON.parse(event.newValue);
        renderFlightData(incomingData);
    } catch (error) {
        console.warn('No se pudo sincronizar el estado del widget.', error);
    }
}

function handleBroadcastMessage(event) {
    if (!event.data || event.data.type !== 'sync') return;
    renderFlightData(event.data.payload);
}

function updateZuluTime() {
    const zuluElement = document.getElementById('widget-zulu-time');
    if (!zuluElement) return;

    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');

    zuluElement.textContent = `${hours}:${minutes}:${seconds} Z`;
}

document.addEventListener('DOMContentLoaded', () => {
    buildBoards();

    const btnUpdate = document.getElementById('btn-update');
    if (btnUpdate) btnUpdate.addEventListener('click', updateBoard);

    bindInputs();
    window.addEventListener('storage', handleStorageSync);

    if (window.BroadcastChannel) {
        window.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        window.broadcastChannel.addEventListener('message', handleBroadcastMessage);
    }

    setTimeout(() => {
        applyInitialState();
    }, 500);

    updateZuluTime();
    setInterval(updateZuluTime, 1000);
});
