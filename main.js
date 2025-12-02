// Main application entry point

// Initialize application
function initializeApp() {
    console.log('Initializing Battleship game...');

    // Initialize UI components
    initializeShipInventory();
    initializeEventListeners();
    initializeTooltips();

    // Initialize placement grid
    const placementGrid = document.getElementById('placementGrid');
    initializeGrid(placementGrid, handlePlacementCellClick);

    // Initialize multiplayer connection
    initializeMultiplayer();

    // Set initial status
    updateStatus('Connecting to server...');

    console.log('Battleship game initialized!');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
