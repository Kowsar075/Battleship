// Game state and configuration
const SHIP_CONFIG = {
    carrier: { name: 'Carrier', size: 10, width: 5, height: 2 },
    cruiser: { name: 'Cruiser', size: 6, width: 3, height: 2 },
    destroyer: { name: 'Destroyer', size: 5, width: 5, height: 1 },
    frigate: { name: 'Frigate', size: 4, width: 4, height: 1 },
    submarine: { name: 'Submarine', size: 4, width: 2, height: 2 },
    corvette: { name: 'Corvette', size: 3, width: 3, height: 1 }
};

const GRID_SIZE = 10;

const gameState = {
    playerId: null,
    gameId: null,
    phase: 'setup', // setup, playing, finished
    ships: [],
    placedShips: [],
    opponentShots: [],
    myShots: [],
    currentTurn: null,
    timerInterval: null
};

// Initialize grids
function initializeGrid(gridElement, clickHandler = null) {
    gridElement.innerHTML = '';

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            if (clickHandler) {
                cell.addEventListener('click', () => clickHandler(row, col));
            }

            gridElement.appendChild(cell);
        }
    }
}

// Handle cell click during placement
function handlePlacementCellClick(row, col) {
    if (gameState.phase !== 'setup') return;

    const selectedShip = document.querySelector('.ship-item.selected');
    if (!selectedShip) return;

    const shipType = selectedShip.dataset.type;
    const ship = SHIP_CONFIG[shipType];

    // Try to place ship
    if (canPlaceShip(row, col, ship, gameState.currentOrientation || 'horizontal')) {
        placeShip(row, col, ship, shipType, gameState.currentOrientation || 'horizontal');
        selectedShip.classList.remove('selected');
        selectedShip.classList.add('placed');
        checkAllShipsPlaced();
    }
}

// Handle cell click during gameplay
function handleGameplayCellClick(row, col) {
    if (gameState.phase !== 'playing') return;
    if (gameState.currentTurn !== gameState.playerId) {
        showNotification('Not your turn!');
        return;
    }

    const cell = getCellElement('opponentGrid', row, col);
    if (cell && (cell.classList.contains('hit') || cell.classList.contains('miss'))) {
        showNotification('Already shot this cell!');
        return;
    }

    fireShot(row, col);
}


// Check if ship can be placed at position
function canPlaceShip(startRow, startCol, ship, orientation) {
    const cells = getShipCells(startRow, startCol, ship, orientation);

    if (!cells) return false;

    // Check for overlaps with existing ships
    for (let placedShip of gameState.placedShips) {
        for (let placedCell of placedShip.cells) {
            for (let cell of cells) {
                if (placedCell.row === cell.row && placedCell.col === cell.col) {
                    return false;
                }
            }
        }
    }

    return true;
}

// Get cells occupied by ship
function getShipCells(startRow, startCol, ship, orientation) {
    const cells = [];

    if (ship.width && ship.height) {
        // Special case for carrier (5x2) and other multi-row ships
        const width = orientation === 'horizontal' ? ship.width : ship.height;
        const height = orientation === 'horizontal' ? ship.height : ship.width;

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const row = startRow + r;
                const col = startCol + c;

                if (row >= GRID_SIZE || col >= GRID_SIZE) {
                    return null; // Out of bounds
                }

                cells.push({ row, col, hit: false });
            }
        }
    } else {
        // Linear ships
        const length = ship.size;

        for (let i = 0; i < length; i++) {
            const row = orientation === 'horizontal' ? startRow : startRow + i;
            const col = orientation === 'horizontal' ? startCol + i : startCol;

            if (row >= GRID_SIZE || col >= GRID_SIZE) {
                return null; // Out of bounds
            }

            cells.push({ row, col, hit: false });
        }
    }

    return cells;
}

// Place ship on grid
function placeShip(startRow, startCol, ship, shipType, orientation) {
    const cells = getShipCells(startRow, startCol, ship, orientation);

    gameState.placedShips.push({
        type: shipType,
        name: ship.name,
        cells: cells,
        orientation: orientation
    });

    // Update visual grid
    const grid = document.getElementById('placementGrid');
    cells.forEach(cell => {
        const cellElement = grid.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
        if (cellElement) {
            cellElement.classList.add('ship');
        }
    });
}

// Shuffle ships randomly
function shuffleShips() {
    clearAllShips();

    const shipTypes = Object.keys(SHIP_CONFIG);

    for (let shipType of shipTypes) {
        const ship = SHIP_CONFIG[shipType];
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 100) {
            const row = Math.floor(Math.random() * GRID_SIZE);
            const col = Math.floor(Math.random() * GRID_SIZE);
            const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

            if (canPlaceShip(row, col, ship, orientation)) {
                placeShip(row, col, ship, shipType, orientation);
                placed = true;

                // Mark ship as placed in inventory
                const shipItem = document.querySelector(`[data-type="${shipType}"]`);
                if (shipItem) {
                    shipItem.classList.add('placed');
                }
            }

            attempts++;
        }
    }

    checkAllShipsPlaced();
}

// Clear all ships
function clearAllShips() {
    gameState.placedShips = [];

    const grid = document.getElementById('placementGrid');
    const cells = grid.querySelectorAll('.grid-cell');
    cells.forEach(cell => cell.classList.remove('ship'));

    const shipItems = document.querySelectorAll('.ship-item');
    shipItems.forEach(item => item.classList.remove('placed', 'selected'));

    document.getElementById('readyBtn').disabled = true;
}

// Check if all ships are placed
function checkAllShipsPlaced() {
    const allPlaced = gameState.placedShips.length === Object.keys(SHIP_CONFIG).length;
    document.getElementById('readyBtn').disabled = !allPlaced;
}

// Rotate ship orientation
function rotateShip() {
    gameState.currentOrientation = gameState.currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
}

// Get cell element
function getCellElement(gridId, row, col) {
    const grid = document.getElementById(gridId);
    return grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

// Update cell visual state
function updateCellState(gridId, row, col, state) {
    const cell = getCellElement(gridId, row, col);
    if (cell) {
        cell.classList.add(state);
    }
}
