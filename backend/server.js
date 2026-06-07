require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const redisStore = require('./redis');
const { createDefaultBoard, applyMutation } = require('./boardManager');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Track active users per board: boardId -> Map<socketId, userInfo>
const boardPresence = new Map();

// REST: create or get a board
app.get('/api/board/:boardId', async (req, res) => {
  const { boardId } = req.params;
  let state = await redisStore.getBoardState(boardId);
  if (!state) {
    state = createDefaultBoard(boardId, req.query.name || 'SyncSpace Board');
    await redisStore.setBoardState(boardId, state);
  }
  res.json(state);
});

// REST: create a new board and redirect
app.post('/api/board', async (req, res) => {
  const boardId = uuidv4().slice(0, 8);
  const state = createDefaultBoard(boardId, req.body.name || 'My Board');
  await redisStore.setBoardState(boardId, state);
  res.json({ boardId, state });
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// Socket.io
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  let currentBoardId = null;
  let currentUser = null;

  // Join a board room
  socket.on('join_board', async ({ boardId, user }) => {
    if (currentBoardId) {
      socket.leave(currentBoardId);
      removePresence(currentBoardId, socket.id);
      broadcastPresence(currentBoardId);
    }

    currentBoardId = boardId;
    currentUser = { id: socket.id, name: user?.name || 'Anonymous', color: user?.color || randomColor(), cursor: null };

    socket.join(boardId);

    // Add to presence
    if (!boardPresence.has(boardId)) boardPresence.set(boardId, new Map());
    boardPresence.get(boardId).set(socket.id, currentUser);

    // Send current board state
    let state = await redisStore.getBoardState(boardId);
    if (!state) {
      state = createDefaultBoard(boardId);
      await redisStore.setBoardState(boardId, state);
    }
    socket.emit('board_state', state);

    // Broadcast updated presence
    broadcastPresence(boardId);
    console.log(`[Socket] ${currentUser.name} joined board ${boardId}`);
  });

  // Handle a board mutation (delta update)
  socket.on('mutation', async ({ boardId, mutation }) => {
    if (boardId !== currentBoardId) return;

    let state = await redisStore.getBoardState(boardId);
    if (!state) return socket.emit('error', { message: 'Board not found' });

    const result = applyMutation(state, mutation);

    if (!result.success) {
      // Send full state back to client to re-sync
      socket.emit('board_state', state);
      socket.emit('mutation_rejected', { reason: result.error, mutation });
      return;
    }

    await redisStore.setBoardState(boardId, result.state);

    // Broadcast delta to all OTHER clients in the room
    socket.to(boardId).emit('mutation_applied', {
      mutation,
      state: result.state,
      fromSocketId: socket.id,
    });

    // Confirm to sender
    socket.emit('mutation_confirmed', {
      mutation,
      state: result.state,
    });
  });

  // Cursor position broadcast
  socket.on('cursor_move', ({ boardId, position }) => {
    if (boardId !== currentBoardId || !currentUser) return;
    currentUser.cursor = position;
    if (boardPresence.has(boardId)) {
      boardPresence.get(boardId).set(socket.id, currentUser);
    }
    socket.to(boardId).emit('cursor_update', {
      userId: socket.id,
      user: currentUser,
      position,
    });
  });

  // Typing indicator
  socket.on('typing', ({ boardId, cardId, isTyping }) => {
    socket.to(boardId).emit('user_typing', {
      userId: socket.id,
      user: currentUser,
      cardId,
      isTyping,
    });
  });

  socket.on('disconnect', () => {
    if (currentBoardId) {
      removePresence(currentBoardId, socket.id);
      broadcastPresence(currentBoardId);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

function removePresence(boardId, socketId) {
  if (boardPresence.has(boardId)) {
    boardPresence.get(boardId).delete(socketId);
    if (boardPresence.get(boardId).size === 0) boardPresence.delete(boardId);
  }
}

function broadcastPresence(boardId) {
  const users = boardPresence.has(boardId)
    ? Array.from(boardPresence.get(boardId).values())
    : [];
  io.to(boardId).emit('presence_update', { users });
}

function randomColor() {
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316'];
  return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 3001;
redisStore.connect().then(() => {
  server.listen(PORT, () => {
    console.log(`[Server] SyncSpace backend running on http://localhost:${PORT}`);
  });
});
