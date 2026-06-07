# SyncSpace — Real-Time Collaborative Task Board

A full-stack real-time collaborative workspace where multiple users can manage tasks on a shared Trello-style board simultaneously. Built with Vue 3, Node.js/Express, Socket.io, and Redis.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Vue 3 Client                         │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │  Board UI   │  │  Pinia     │  │  Socket.io       │  │
│  │  (draggable │  │  Store     │  │  Composable      │  │
│  │   columns)  │  │ (optimistic│  │  (reconnection   │  │
│  │             │  │  updates)  │  │   handling)      │  │
│  └─────────────┘  └────────────┘  └──────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │ WebSocket (Socket.io)
                           │ REST (Axios)
┌──────────────────────────▼───────────────────────────────┐
│               Node.js / Express Server                    │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  REST API    │  │  Socket.io  │  │  Board Manager  │  │
│  │  /api/board  │  │  (rooms /   │  │  (mutation +    │  │
│  │              │  │   presence) │  │  conflict logic)│  │
│  └──────────────┘  └─────────────┘  └─────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                    Redis                                  │
│          Board state persistence (24h TTL)               │
│          In-memory fallback if Redis unavailable         │
└──────────────────────────────────────────────────────────┘
```

## Key Technical Features

### Real-Time Synchronization
- Persistent bidirectional WebSocket channels via Socket.io
- Delta-based mutation system — only changes are broadcast, not full state
- Server-side version control with conflict detection (rejects mutations > 10 versions stale)

### Optimistic UI Updates
- Every user action is applied locally immediately before server confirmation
- Automatic rollback to server state on mutation rejection
- Visual "Saving..." indicator for in-flight mutations

### Connection Recovery
- Automatic reconnection with exponential backoff (1s → 5s)
- On reconnect: automatically re-joins board room and re-syncs full state
- Connection status indicator (connected / reconnecting / disconnected)

### Distributed State (Redis)
- Board state persisted in Redis with 24-hour TTL
- Graceful in-memory fallback when Redis is unavailable
- Boards shareable via unique 8-character ID

### Presence System
- Live user avatars showing all connected collaborators
- User join/leave events broadcast in real time

---

## Project Structure

```
syncspace/
├── backend/
│   ├── server.js          # Express + Socket.io entry point
│   ├── boardManager.js    # Mutation engine + conflict resolution
│   ├── redis.js           # Redis client with in-memory fallback
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.vue                        # Root: landing + board view
    │   ├── main.js
    │   ├── style.css
    │   ├── composables/
    │   │   └── useSocket.js               # Socket.io singleton + reconnection
    │   ├── stores/
    │   │   └── boardStore.js              # Pinia store with optimistic mutations
    │   └── components/
    │       ├── BoardColumn.vue            # Column with drag-and-drop cards
    │       ├── BoardCard.vue              # Individual card display
    │       ├── CardModal.vue              # Card detail/edit modal
    │       └── PresenceAvatars.vue        # Online user indicators
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Redis (optional — falls back to in-memory if unavailable)

### 1. Start Redis (optional)
```bash
# macOS
brew install redis && brew services start redis

# Ubuntu
sudo apt install redis-server && sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev       # Runs on http://localhost:3001
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev       # Runs on http://localhost:5173
```

### 4. Use It
1. Open `http://localhost:5173` in multiple browser tabs/windows
2. Enter your name and click **Create New Board**
3. Copy the Board ID from the top bar
4. Open another tab, enter a different name, paste the Board ID → **Join Board**
5. Changes in one tab appear instantly in all others

---

## Supported Mutations

| Type | Description |
|------|-------------|
| `ADD_CARD` | Add a card to a column |
| `UPDATE_CARD` | Edit title, description, or color |
| `DELETE_CARD` | Remove a card |
| `MOVE_CARD` | Drag card to new column/position |
| `ADD_COLUMN` | Create a new column |
| `UPDATE_COLUMN` | Rename a column |
| `DELETE_COLUMN` | Remove column and its cards |
| `UPDATE_BOARD_NAME` | Rename the board |

---

## Environment Variables

### Backend `.env`
```
PORT=3001
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:5173
```

### Frontend (optional `.env`)
```
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```
