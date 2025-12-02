// Gameplay mechanics
let turnTimer = null;
const TURN_TIME = 15; // seconds

// Update turn status
function updateTurnStatus() {
    const isMyTurn = gameState.currentTurn === gameState.playerId;
    logger.log('updateTurnStatus called', { currentTurn: gameState.currentTurn, playerId: gameState.playerId, isMyTurn });

    if (isMyTurn) {
        updateStatus('YOUR TURN - Fire at enemy waters!');
        enableOpponentGrid();
        startTurnTimer();
    } else {
        updateStatus("OPPONENT'S TURN - Wait for their move");
        disableOpponentGrid();
        stopTurnTimer();
    }
}

// Start turn timer
function startTurnTimer() {
    logger.log('Starting turn timer');
    stopTurnTimer(); // Clear any existing timer

    let timeLeft = TURN_TIME;
    const timerDisplay = document.getElementById('timerDisplay');
    const timerText = document.getElementById('timerText');

    timerDisplay.classList.remove('hidden');
    timerText.textContent = timeLeft;

    turnTimer = setInterval(() => {
        timeLeft--;
        timerText.textContent = timeLeft;

        if (timeLeft <= 5) {
            timerDisplay.classList.add('warning');
        }

        if (timeLeft <= 0) {
            logger.log('Timer expired - skipping turn');
            stopTurnTimer();
            // Skip turn if time runs out
            skipTurn();
        }
    }, 1000);
}

// Stop turn timer
function stopTurnTimer() {
    if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
    }

    const timerDisplay = document.getElementById('timerDisplay');
    timerDisplay.classList.add('hidden');
    timerDisplay.classList.remove('warning');
}

// Skip turn when timer runs out
function skipTurn() {
    logger.log('skipTurn called', { currentTurn: gameState.currentTurn });
    showNotification('Time ran out! Turn skipped.');

    // Emit a skip-turn event to server - server will handle turn switching
    if (socket) {
        socket.emit('skip-turn');
    }
}

// Show game over modal
function showGameOver(isWinner, winnerName) {
    const modal = document.getElementById('gameOverModal');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');

    if (isWinner) {
        title.textContent = 'VICTORY!';
        title.style.color = '#00ff00';
        message.textContent = 'You have destroyed all enemy ships!';
    } else {
        title.textContent = 'DEFEAT';
        title.style.color = '#ff0000';
        message.textContent = `${winnerName} has destroyed all your ships.`;
    }

    modal.classList.remove('hidden');
    stopTurnTimer();
}

// Start new game
function startNewGame() {
    window.location.href = window.location.pathname;
}

// Calculate game statistics
function getGameStats() {
    const totalShots = gameState.myShots.length;
    const hits = gameState.myShots.filter(shot => shot.hit).length;
    const accuracy = totalShots > 0 ? Math.round((hits / totalShots) * 100) : 0;

    return {
        totalShots,
        hits,
        misses: totalShots - hits,
        accuracy
    };
}
