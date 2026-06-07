const { createClient } = require('redis');

let client = null;
let isConnected = false;

// In-memory fallback store when Redis is unavailable
const memoryStore = new Map();

async function connect() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  client = createClient({ url: redisUrl });

  client.on('error', (err) => {
    if (isConnected) console.warn('[Redis] Connection lost, using in-memory fallback');
    isConnected = false;
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
    isConnected = true;
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn('[Redis] Could not connect — running with in-memory store');
  }
}

async function getBoardState(boardId) {
  const key = `board:${boardId}`;
  try {
    if (isConnected) {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch {}
  const data = memoryStore.get(key);
  return data ? JSON.parse(data) : null;
}

async function setBoardState(boardId, state) {
  const key = `board:${boardId}`;
  const serialized = JSON.stringify(state);
  try {
    if (isConnected) {
      await client.set(key, serialized, { EX: 86400 }); // 24h TTL
      return;
    }
  } catch {}
  memoryStore.set(key, serialized);
}

module.exports = { connect, getBoardState, setBoardState };
