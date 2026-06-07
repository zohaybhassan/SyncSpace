const { createClient } = require('redis');

let client = null;
let isConnected = false;

// In-memory fallback store when Redis is unavailable
const memoryStore = new Map();

async function connect() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: false, // don't retry, fall back to memory immediately
    },
  });

  client.on('error', () => {
    isConnected = false;
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
    isConnected = true;
  });

  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2000)
    );
    await Promise.race([client.connect(), timeout]);
  } catch (err) {
    console.warn('[Redis] Not available — running with in-memory store only');
    try { await client.quit(); } catch {}
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
