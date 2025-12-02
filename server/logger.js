const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Log file path
const logFile = path.join(logsDir, `server-${Date.now()}.log`);

// Logger function
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${message}`;

    if (data) {
        logMessage += ` | Data: ${JSON.stringify(data)}`;
    }

    logMessage += '\n';

    // Write to file
    fs.appendFileSync(logFile, logMessage);

    // Also log to console
    console.log(logMessage.trim());
}

module.exports = { log };
