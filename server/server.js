const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { log } = require('./logger');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// In-memory game storage
const games = new Map();

// Ship configuration
const SHIP_CONFIG = {
  carrier: { name: 'Carrier', size: 10, width: 5, height: 2 },
  cruiser: { name: 'Cruiser', size: 6 },
  destroyer: { name: 'Destroyer', size: 5 },
  frigate: { name: 'Frigate', size: 4 },
  submarine: { name: 'Submarine', size: 4 },
  corvette: { name: 'Corvette', size: 3 }
};

// Generate unique game ID
function generateGameId() {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

// Create new game
app.post('/api/create-game', (req, res) => {
  const gameId = generateGameId();
  games.set(gameId, {
    id: gameId,
    players: {},
    currentTurn: null,
    status: 'waiting', // waiting, setup, playing, finished
    winner: null,
    createdAt: Date.now()
  });

  res.json({ gameId, url: `http://localhost:3000?game=${gameId}` });
});

// Get game info
app.get('/api/game/:gameId', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  res.json({ exists: true, playerCount: Object.keys(game.players).length });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  log('New client connected', { socketId: socket.id });

  // Join game
  socket.on('join-game', ({ gameId, playerName }) => {
    const game = games.get(gameId);

    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const playerCount = Object.keys(game.players).length;

    if (playerCount >= 2) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    const playerId = playerCount === 0 ? 'player1' : 'player2';

    game.players[playerId] = {
      id: socket.id,
      name: playerName || `Player ${playerCount + 1}`,
      ships: [],
      shots: [],
      ready: false
    };

    socket.join(gameId);
    socket.gameId = gameId;
    socket.playerId = playerId;

    socket.emit('joined-game', {
      playerId,
      gameId,
      playerCount: Object.keys(game.players).length
    });

    // Notify other players
    socket.to(gameId).emit('player-joined', {
      playerId,
      playerCount: Object.keys(game.players).length
    });

    log('Player joined game', { playerId, gameId, socketId: socket.id });
  });

  // Place ships
  socket.on('place-ships', ({ ships }) => {
    const gameId = socket.gameId;
    const playerId = socket.playerId;
    const game = games.get(gameId);

    if (!game || !game.players[playerId]) {
      socket.emit('error', { message: 'Invalid game or player' });
      return;
    }

    game.players[playerId].ships = ships;
    socket.emit('ships-placed', { success: true });

    log('Player placed ships', { playerId, gameId, shipCount: ships.length });
  });

  // Player ready
  socket.on('player-ready', () => {
    const gameId = socket.gameId;
    const playerId = socket.playerId;
    const game = games.get(gameId);

    if (!game || !game.players[playerId]) {
      socket.emit('error', { message: 'Invalid game or player' });
      return;
    }

    game.players[playerId].ready = true;

    // Check if both players are ready
    const allReady = Object.values(game.players).every(p => p.ready);

    if (allReady && Object.keys(game.players).length === 2) {
      game.status = 'playing';
      game.currentTurn = 'player1';

      io.to(gameId).emit('game-start', {
        currentTurn: game.currentTurn
      });

      log('Game started', { gameId, currentTurn: game.currentTurn });
    } else {
      socket.to(gameId).emit('player-ready-status', { playerId });
    }
  });

  // Fire shot
  socket.on('fire-shot', ({ row, col }) => {
    const gameId = socket.gameId;
    const playerId = socket.playerId;
    const game = games.get(gameId);

    if (!game || game.status !== 'playing') {
      socket.emit('error', { message: 'Game not in playing state' });
      return;
    }

    if (game.currentTurn !== playerId) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Determine opponent
    const opponentId = playerId === 'player1' ? 'player2' : 'player1';
    const opponent = game.players[opponentId];

    // Check if shot hits any ship
    let hit = false;
    let sunkShip = null;

    for (let ship of opponent.ships) {
      for (let cell of ship.cells) {
        if (cell.row === row && cell.col === col) {
          hit = true;
          cell.hit = true;

          // Check if ship is sunk
          const allHit = ship.cells.every(c => c.hit);
          if (allHit) {
            sunkShip = ship.type;
          }
          break;
        }
      }
      if (hit) break;
    }

    // Record shot
    game.players[playerId].shots.push({ row, col, hit });

    // Check win condition
    const allShipsSunk = opponent.ships.every(ship =>
      ship.cells.every(cell => cell.hit)
    );

    if (allShipsSunk) {
      game.status = 'finished';
      game.winner = playerId;

      io.to(gameId).emit('game-over', {
        winner: playerId,
        winnerName: game.players[playerId].name
      });
    } else {
      // Switch turns
      game.currentTurn = opponentId;

      log('Turn switched after shot', { gameId, newTurn: opponentId, shot: { row, col, hit } });

      // Notify both players
      io.to(game.players[playerId].id).emit('shot-result', {
        row,
        col,
        hit,
        sunkShip,
        yourTurn: false
      });

      io.to(opponent.id).emit('opponent-shot', {
        row,
        col,
        hit,
        sunkShip,
        yourTurn: true
      });
    }

    log('Shot fired', { gameId, playerId, row, col, hit, sunkShip });
  });

  // Handle skip turn (when timer runs out)
  socket.on('skip-turn', () => {
    const gameId = socket.gameId;
    const playerId = socket.playerId;
    const game = games.get(gameId);

    log('Skip turn received', { gameId, playerId, currentTurn: game?.currentTurn });

    if (!game || game.status !== 'playing') {
      log('Skip turn rejected - invalid game state', { gameId, status: game?.status });
      return;
    }

    if (game.currentTurn !== playerId) {
      log('Skip turn rejected - not their turn', { gameId, playerId, currentTurn: game.currentTurn });
      return; // Not their turn anyway
    }

    // Switch turns
    const opponentId = playerId === 'player1' ? 'player2' : 'player1';
    const oldTurn = game.currentTurn;
    game.currentTurn = opponentId;

    log('Turn skipped - switching turns', { gameId, oldTurn, newTurn: opponentId });

    // Notify the player who skipped that their turn is over
    socket.emit('turn-skipped', { yourTurn: false });
    log('Sent turn-skipped event', { to: playerId, socketId: socket.id });

    // Notify opponent that it's now their turn
    const opponent = game.players[opponentId];
    if (opponent) {
      io.to(opponent.id).emit('opponent-skipped', { yourTurn: true });
      log('Sent opponent-skipped event', { to: opponentId, socketId: opponent.id });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    const gameId = socket.gameId;
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        socket.to(gameId).emit('player-disconnected', {
          playerId: socket.playerId
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Battleship server running on port ${PORT}`);
});
