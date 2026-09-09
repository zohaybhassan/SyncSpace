# SyncSpace

SyncSpace is a real-time collaborative task board built with Vue 3, Node.js/Express, Socket.IO, and Redis (with an in-memory fallback). Multiple users can join the same board and see updates instantly.

## Features

- Real-time board synchronization over WebSockets
- Optimistic client updates with server confirmation/rejection handling
- Shared presence indicators for active collaborators
- Redis-backed board persistence with in-memory fallback
- Drag-and-drop card movement across columns

## Tech Stack

- **Frontend:** Vue 3, Pinia, Vite, Tailwind CSS, Socket.IO Client
- **Backend:** Node.js, Express, Socket.IO, Redis
- **Testing:** Node.js built-in test runner (`node:test`) for backend mutation logic

## Project Structure

```text
SyncSpace/
├── backend/
│   ├── boardManager.js
│   ├── redis.js
│   ├── server.js
│   ├── test/
│   │   └── boardManager.test.js
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── stores/
│   │   ├── App.vue
│   │   └── main.js
│   └── package.json
├── .gitignore
└── package.json
```

## Architecture Overview

1. Frontend loads or creates a board via REST (`GET /api/board/:boardId`, `POST /api/board`).
2. Frontend joins a Socket.IO room for that board.
3. Mutations are sent as deltas and applied on the server (`boardManager.js`).
4. Server broadcasts applied updates and presence changes to connected users.
5. Board state is stored in Redis (24h TTL) or in-memory if Redis is unavailable.

## Prerequisites

- Node.js 18+
- npm 9+
- Redis (optional; backend runs without it)

## Setup

From the repository root:

```bash
npm run install:all
```

Or manually:

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

## Running Locally

In one terminal, run the backend:

```bash
npm --prefix backend run dev
```

In another terminal, run the frontend:

```bash
npm --prefix frontend run dev
```

Then open `http://localhost:5173`.

By default, the Vite frontend uses port 5173 and the backend API uses port 3001.

## Environment Configuration

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and adjust as needed.

```env
PORT=3001
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:5173
```

### Frontend (optional `frontend/.env`)

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

## Scripts

### Root scripts

- `npm run install:all` - install backend and frontend dependencies
- `npm run lint` - run backend and frontend lint checks
- `npm run test` - run backend unit tests
- `npm run build` - build frontend for production
- `npm run check` - run lint + test + build

### Backend scripts

- `npm --prefix backend run dev` - start backend with nodemon
- `npm --prefix backend run start` - start backend with node
- `npm --prefix backend run lint` - syntax checks for backend JS files
- `npm --prefix backend run test` - board manager unit tests

### Frontend scripts

- `npm --prefix frontend run dev` - start Vite dev server
- `npm --prefix frontend run build` - production build
- `npm --prefix frontend run preview` - preview production build
- `npm --prefix frontend run lint` - syntax checks for frontend JS/config files

## Testing Notes

- Current automated tests target backend mutation behavior (`backend/test/boardManager.test.js`).
- Frontend does not yet include component/unit test infrastructure.
- Recommended next step: add Vitest + Vue Test Utils for store and component interaction tests.

## Contributing

1. Create a feature branch.
2. Keep changes focused and incremental.
3. Run `npm run check` before opening a PR.
4. Include test updates for behavior changes.
5. Update this README when setup/scripts/architecture changes.

## Reliability Improvements Included

- Fixed drag-and-drop move event payloads to correctly preserve **source** and **destination** column IDs for cross-column card moves.
