const express = require('express');
const path = require('path');
const app = express();

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Frontend server running on http://localhost:${PORT}`);
    console.log('Open this URL in your browser to play Battleship!');
});
