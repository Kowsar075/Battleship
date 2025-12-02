// Client-side logger
class ClientLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            message,
            data,
            playerId: gameState?.playerId || 'unknown',
            gameId: gameState?.gameId || 'unknown',
            currentTurn: gameState?.currentTurn || 'unknown'
        };

        this.logs.push(logEntry);

        // Keep only last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Log to console with formatting
        console.log(`[${timestamp}] [${logEntry.playerId}] ${message}`, data || '');
    }

    downloadLogs() {
        const logText = this.logs.map(entry => {
            let line = `[${entry.timestamp}] [Player: ${entry.playerId}] [Game: ${entry.gameId}] [Turn: ${entry.currentTurn}] ${entry.message}`;
            if (entry.data) {
                line += ` | ${JSON.stringify(entry.data)}`;
            }
            return line;
        }).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `battleship-client-${Date.now()}.log`;
        a.click();
        URL.revokeObjectURL(url);
    }

    getLogs() {
        return this.logs;
    }
}

const logger = new ClientLogger();

// Add download logs button functionality
window.downloadLogs = () => logger.downloadLogs();
