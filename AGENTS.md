# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Running the project

The only supported dev workflow is Docker Compose (no local Node required):

```bash
docker compose up --build       # build + start all services
docker compose up               # start without rebuilding
docker compose down             # stop
```

Services after startup:
- Frontend (React + Vite): http://localhost:5173
- Backend (Fastify + Socket.IO): http://localhost:3001/health
- Cloudflare tunnel: printed to stdout (exposes frontend publicly via trycloudflare.com)

Hot-reload is active for both services via bind-mounted volumes.

## Architecture

Single-file apps — no router, no state management library, no component folder:

- `apps/backend/src/index.ts` — the entire server: in-memory state, all game logic, all Socket.IO event handlers. No database; state lives in three `Map`s (`rooms`, `playerRoom`, `socketPlayer`).
- `apps/frontend/src/App.tsx` — the entire client: Socket.IO connection, all game state as `useState`, all UI. No React Router; single screen with conditional rendering.

### Backend state model

```
rooms: Map<roomCode, Room>
playerRoom: Map<playerId, roomCode>   // cross-index
socketPlayer: Map<socketId, playerId> // cross-index
```

`serializeRoom()` strips private fields (actual `hand` values) before broadcasting. Each player's private hand is sent only to their own socket via `player:state`.

### Socket.IO event contract

All client→server events accept an optional `ack` callback `(response) => void` where `response` is `{ ok: boolean, error?: string, ...data }`.

Key events:
- `room:create` / `room:join` — lobby entry; `room:join` also handles reconnection (same `playerId` = rejoin)
- `player:ready` — toggles ready; auto-starts if all ready in lobby
- `game:start` — host-only explicit start
- `game:play-card` — validates lowest-card rule; triggers error penalty if blocking cards exist
- `game:pause-request` — any player; resumes when all re-ready
- `star:propose` / `star:accept` — consensus flow; star resolves when all connected players accept
- `game:retry` — host-only restart from level 1

Server→client broadcasts:
- `room:update` — full room snapshot (sent after every state change)
- `player:state` — private hand (sent per-socket alongside `room:update`)
- `game:log` — individual log entry (also replayed via `room:update.logs`)
- `game:error-penalty`, `game:paused`, `game:star-used`, `game:level-complete`, `game:next-level-ready`, `game:started`, `game:restarted`, `game:over`

### Frontend connection & reconnection

`playerId` is persisted in `localStorage` (`th:playerId`) and generated once per browser. On socket `connect`, if no current room and `th:lastRoomCode` + `th:playerName` exist, the client auto-joins — this is the reconnection path. `manualAccessRef` prevents auto-join from racing with explicit create/join flows.

### Game rules encoded in backend

- Cards 1–100, shuffled per level; each player gets `level` cards.
- Must always play personal minimum card (`minCard !== card` → error).
- Playing a card with lower-value cards still in any hand → life penalty + auto-discard of all blocking cards.
- Level rewards at fixed levels: `{ 2: star, 3: life, 5: star, 6: life, 8: star, 9: life }`.
- Max lives capped at 5, max stars at 3.
- Max levels: 2 players → 12, 3 → 10, 4 → 8.

## Environment variables

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `PORT` | backend | `3001` | HTTP/WS port |
| `CLIENT_ORIGIN` | backend | `http://localhost:5173` | CORS origin (`*` in Docker) |
| `VITE_SOCKET_URL` | frontend | `window.location.origin` | Socket.IO server URL |
| `VITE_PROXY_TARGET` | frontend build | `http://localhost:3001` | Vite proxy target |

The Vite dev server proxies `/socket.io` and `/health` to the backend, so the frontend connects to its own origin and avoids cross-origin issues.
