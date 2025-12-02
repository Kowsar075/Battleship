// UI management and interactions

// Update status message
function updateStatus(message) {
    document.getElementById('statusText').textContent = message;
}

// Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 255, 0, 0.2);
    border: 2px solid #00ff00;
    color: #00ff00;
    padding: 15px 25px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 2000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
  `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize ship inventory
function initializeShipInventory() {
    const shipList = document.getElementById('shipList');
    shipList.innerHTML = '';

    Object.entries(SHIP_CONFIG).forEach(([type, ship]) => {
        const shipItem = document.createElement('div');
        shipItem.className = 'ship-item';
        shipItem.dataset.type = type;

        // Create visual representation
        const visual = document.createElement('div');
        visual.className = 'ship-visual';

        if (ship.width && ship.height) {
            // Multi-row ships (like carrier 5x2)
            for (let i = 0; i < ship.size; i++) {
                const cell = document.createElement('div');
                cell.className = 'ship-cell';
                visual.appendChild(cell);
            }
        } else {
            // Linear ships
            for (let i = 0; i < ship.size; i++) {
                const cell = document.createElement('div');
                cell.className = 'ship-cell';
                visual.appendChild(cell);
            }
        }

        shipItem.innerHTML = `
      <div class="ship-name">${ship.name}</div>
      <div class="ship-size">${ship.size} cells</div>
    `;
        shipItem.appendChild(visual);

        // Add click to select
        shipItem.addEventListener('click', () => {
            if (shipItem.classList.contains('placed')) return;

            // Deselect all others
            document.querySelectorAll('.ship-item').forEach(item => {
                item.classList.remove('selected');
            });

            shipItem.classList.add('selected');
            gameState.currentOrientation = 'horizontal';
        });

        shipList.appendChild(shipItem);
    });
}

// Initialize event listeners
function initializeEventListeners() {
    // Shuffle button
    document.getElementById('shuffleBtn').addEventListener('click', shuffleShips);

    // Delete button
    document.getElementById('deleteBtn').addEventListener('click', clearAllShips);

    // Ready button
    document.getElementById('readyBtn').addEventListener('click', sendReady);

    // Sound button (toggle)
    let soundEnabled = true;
    document.getElementById('soundBtn').addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        const icon = document.querySelector('#soundBtn .icon');
        icon.textContent = soundEnabled ? '🔊' : '🔇';
    });

    // Close button
    document.getElementById('closeBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to quit?')) {
            window.close();
        }
    });

    // Copy link button
    document.getElementById('copyLinkBtn').addEventListener('click', copyGameLink);

    // Close link modal button
    document.getElementById('closeLinkModalBtn').addEventListener('click', closeShareLinkModal);

    // New game button
    document.getElementById('newGameBtn').addEventListener('click', startNewGame);

    // Keyboard shortcut for rotation (R key)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
            if (gameState.phase === 'setup') {
                rotateShip();
                const selected = document.querySelector('.ship-item.selected');
                if (selected) {
                    showNotification(`Orientation: ${gameState.currentOrientation}`);
                }
            }
        }
    });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
  
  .ship-item.selected {
    background: rgba(0, 255, 0, 0.3);
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
  }
`;
document.head.appendChild(style);

// Initialize tooltips
function initializeTooltips() {
    const shuffleBtn = document.getElementById('shuffleBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    shuffleBtn.title = 'Randomly place all ships';
    deleteBtn.title = 'Clear all placed ships';
}
