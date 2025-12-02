// Socket.IO connection
let socket = null;
// Automatically detect server URL:
// If on localhost:8080 (dev), connect to localhost:3001
// Otherwise (ngrok/production), connect to the same origin
const SERVER_URL = (window.location.hostname === 'localhost' && window.location.port === '8080')
    ? 'http://localhost:3001'
    : window.location.origin;

// Initialize multiplayer connection
function initializeMultiplayer() {
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        logger.log('Connected to server');
        console.log('Connected to server');
        handleConnection();
    });

    socket.on('joined-game', (data) => {
        gameState.playerId = data.playerId;
        gameState.gameId = data.gameId;

        updateStatus(`You are ${data.playerId === 'player1' ? 'Player 1' : 'Player 2'}`);

        if (data.playerId === 'player1') {
            // Show share link modal
            showShareLinkModal(data.gameId);
        }

        if (data.playerCount === 2) {
            updateStatus('Both players connected. Place your ships!');
            closeShareLinkModal();
        }
    });

    socket.on('player-joined', (data) => {
        if (data.playerCount === 2) {
            updateStatus('Opponent joined! Place your ships!');
            closeShareLinkModal();
        }
    });

    socket.on('player-ready-status', (data) => {
        updateStatus('Opponent is ready. Waiting for you...');
    });

    socket.on('game-start', (data) => {
        logger.log('Game started', data);
        gameState.phase = 'playing';
        gameState.currentTurn = data.currentTurn;

        // Hide setup phase, show game phase
        document.getElementById('setupPhase').classList.add('hidden');
        document.getElementById('gamePhase').classList.remove('hidden');

        // Initialize game grids with appropriate click handlers
        initializeGrid(document.getElementById('yourGrid'), null); // No clicks on your own grid
        initializeGrid(document.getElementById('opponentGrid'), handleGameplayCellClick); // Clicks for shooting

        // Show player's ships on their grid
        displayPlayerShips();

        // Update turn status
        updateTurnStatus();
    });

    socket.on('shot-result', (data) => {
        logger.log('Received shot-result', data);
        // Update opponent grid with our shot
        const state = data.hit ? 'hit' : 'miss';
        updateCellState('opponentGrid', data.row, data.col, state);

        gameState.myShots.push({ row: data.row, col: data.col, hit: data.hit });

        if (data.sunkShip) {
            showNotification(`You sunk the enemy's ${data.sunkShip}!`);
        }

        gameState.currentTurn = data.yourTurn ? gameState.playerId : (gameState.playerId === 'player1' ? 'player2' : 'player1');
        updateTurnStatus();
    });

    socket.on('opponent-shot', (data) => {
        logger.log('Received opponent-shot', data);
        // Update our grid with opponent's shot
        const state = data.hit ? 'hit' : 'miss';
        updateCellState('yourGrid', data.row, data.col, state);

        gameState.opponentShots.push({ row: data.row, col: data.col, hit: data.hit });

        if (data.sunkShip) {
            showNotification(`Enemy sunk your ${data.sunkShip}!`);
        }

        gameState.currentTurn = data.yourTurn ? gameState.playerId : (gameState.playerId === 'player1' ? 'player2' : 'player1');
        updateTurnStatus();
    });

    socket.on('game-over', (data) => {
        gameState.phase = 'finished';

        const isWinner = data.winner === gameState.playerId;
        showGameOver(isWinner, data.winnerName);
    });

    socket.on('turn-skipped', (data) => {
        logger.log('Received turn-skipped event', { oldTurn: gameState.currentTurn });
        // Your turn was skipped, it's now opponent's turn
        gameState.currentTurn = gameState.playerId === 'player1' ? 'player2' : 'player1';
        logger.log('Updated currentTurn after skip', { newTurn: gameState.currentTurn });
        updateTurnStatus();
    });

    socket.on('opponent-skipped', (data) => {
        logger.log('Received opponent-skipped event', { oldTurn: gameState.currentTurn });
        showNotification('Opponent ran out of time! Their turn was skipped.');
        gameState.currentTurn = gameState.playerId;
        logger.log('Updated currentTurn after opponent skip', { newTurn: gameState.currentTurn });
        updateTurnStatus();
    });

    socket.on('player-disconnected', (data) => {
        showNotification('Opponent disconnected');
        updateStatus('Opponent disconnected. Game ended.');
    });

    socket.on('error', (data) => {
        console.error('Socket error:', data.message);
        showNotification(data.message);
    });
}

// Handle initial connection
function handleConnection() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('game');

    if (gameId) {
        // Join existing game
        joinGame(gameId);
    } else {
        // Create new game
        createGame();
    }
}

// Create new game
async function createGame() {
    try {
        const response = await fetch(`${SERVER_URL}/api/create-game`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        // Update URL without reload
        window.history.pushState({}, '', `?game=${data.gameId}`);

        // Join the game
        joinGame(data.gameId);
    } catch (error) {
        console.error('Error creating game:', error);
        updateStatus('Error creating game. Please refresh.');
    }
}

// Join game
function joinGame(gameId) {
    socket.emit('join-game', {
        gameId,
        playerName: `Player ${Math.floor(Math.random() * 1000)}`
    });
}

// Send ready signal
function sendReady() {
    if (gameState.placedShips.length !== Object.keys(SHIP_CONFIG).length) {
        showNotification('Please place all ships first!');
        return;
    }

    // Send ship positions to server
    socket.emit('place-ships', { ships: gameState.placedShips });

    // Send ready signal
    socket.emit('player-ready');

    updateStatus('Waiting for opponent...');
    document.getElementById('readyBtn').disabled = true;
}

// Fire shot at opponent
function fireShot(row, col) {
    logger.log('fireShot called', { row, col, phase: gameState.phase, currentTurn: gameState.currentTurn });
    if (gameState.phase !== 'playing') return;
    if (gameState.currentTurn !== gameState.playerId) {
        showNotification('Not your turn!');
        return;
    }

    // Check if already shot this cell
    const alreadyShot = gameState.myShots.some(shot => shot.row === row && shot.col === col);
    if (alreadyShot) {
        showNotification('Already shot this cell!');
        return;
    }

    socket.emit('fire-shot', { row, col });

    // Disable grid temporarily
    disableOpponentGrid();
}

// Show share link modal
function showShareLinkModal(gameId) {
    const modal = document.getElementById('shareLinkModal');
    const input = document.getElementById('gameLinkInput');

    const url = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
    input.value = url;

    modal.classList.remove('hidden');
}

// Close share link modal
function closeShareLinkModal() {
    document.getElementById('shareLinkModal').classList.add('hidden');
}

// Copy link to clipboard
function copyGameLink() {
    const input = document.getElementById('gameLinkInput');
    input.select();
    document.execCommand('copy');
    showNotification('Link copied to clipboard!');
}

// Display player ships on their grid
function displayPlayerShips() {
    const grid = document.getElementById('yourGrid');

    gameState.placedShips.forEach(ship => {
        ship.cells.forEach(cell => {
            const cellElement = grid.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
            if (cellElement) {
                cellElement.classList.add('ship');
            }
        });
    });
}

// Disable opponent grid
function disableOpponentGrid() {
    const cells = document.querySelectorAll('#opponentGrid .grid-cell');
    cells.forEach(cell => cell.classList.add('disabled'));
}

// Enable opponent grid
function enableOpponentGrid() {
    const cells = document.querySelectorAll('#opponentGrid .grid-cell');
    cells.forEach(cell => cell.classList.remove('disabled'));
}
