# Stack

- Backend: Node.js ESM + TypeScript + Fastify + `@fastify/cors` + Socket.IO. Fuente: `apps/backend/package.json`, `apps/backend/src/index.ts`, `apps/backend/tsconfig.json`.
- Frontend: React 18 + React DOM + Socket.IO Client + Vite + TypeScript. Fuente: `apps/frontend/package.json`, `apps/frontend/src/main.tsx`, `apps/frontend/src/App.tsx`, `apps/frontend/vite.config.ts`.
- Desarrollo local soportado: Docker Compose con servicios `backend`, `frontend` y `tunnel`. Fuente: `docker-compose.yml`, `README.md`.
- Despliegue observado: Render con backend `web_service` y frontend `static_site`. Fuente: `render.yaml`.
- Testing: `node --test` ejecutado via `tsx`, con variantes de cobertura por paquete. Fuente: `apps/backend/package.json`, `apps/frontend/package.json`.

# Capas

- Orquestacion de repo: documentacion raiz y Compose en `README.md`, `docker-compose.yml`, `render.yaml`, `business.md` y `architecture.md`.
- Backend autoritativo: `apps/backend/src/index.ts` concentra transporte HTTP/WebSocket, estado en memoria, reglas del juego, timers y serializacion publica/privada.
- Backend helper: `apps/backend/src/*.ts` separa calculos puros o reglas puntuales como scoring (`finalScoring.ts`), locks (`gameTiming.ts`), participantes (`roundParticipants.ts`), lobby (`lobbyRules.ts`) y estrella (`starResolution.ts`).
- Frontend shell: `apps/frontend/src/main.tsx` monta `App`, mientras `apps/frontend/src/App.tsx` concentra conexion Socket.IO, estado React, overlays y acciones del usuario.
- Frontend helper: `apps/frontend/src/*.ts` extrae logica pura de sincronizacion, layout, copy y UI (`roomSync.ts`, `connectionStatus.ts`, `gameUi.ts`, `lobbyUi.ts`, `handLayout.ts`, `starUi.ts`, `finalScoreUi.ts`, `messageTiming.ts`).
- Tests co-localizados: backend y frontend guardan tests unitarios junto a los modulos en `apps/backend/src/*.test.ts` y `apps/frontend/src/*.test.ts`.

# Estrategia de carpetas

- `apps/backend/`: servicio Node del juego; `src/index.ts` es el entrypoint y los demas archivos son helpers/test.
- `apps/frontend/`: cliente Vite; `src/main.tsx` arranca la app, `src/App.tsx` concentra la UI principal y `src/styles.css` el estilo global.
- `.harness/`: artefactos SDD y templates de regeneracion (`templates/`, `context/`, `plans/`, `implementations/`, `reviews/`).
- `.opencode/`: configuracion local de agentes, comandos y skills; la skill de proyecto observada es `ux-ui-design`.
- Raiz del repo: documentos de contexto (`README.md`, `business.md`, `architecture.md`) y orquestacion (`docker-compose.yml`, `render.yaml`).
- No aplica: no se observo `package.json` en raiz; los manifests viven por aplicacion en `apps/backend/package.json` y `apps/frontend/package.json`.

# Convenciones

- TypeScript estricto en ambos paquetes. Fuente: `apps/backend/tsconfig.json`, `apps/frontend/tsconfig.json`.
- Backend en `NodeNext` con imports ESM terminados en `.js` desde archivos TS compilados. Fuente: `apps/backend/tsconfig.json`, imports de `apps/backend/src/index.ts`.
- Frontend con `moduleResolution: Bundler`, `jsx: react-jsx` y `noEmit: true`. Fuente: `apps/frontend/tsconfig.json`.
- Aplicaciones principales de archivo unico con helpers extraidos, sin router ni libreria externa de estado global. Fuente: `apps/frontend/src/App.tsx`, `apps/frontend/package.json`, arbol `apps/frontend/src/`.
- Estado publico y privado separados explicitamente: el backend emite `room:update`, `player:state` y `room:snapshot`; el frontend recompone los fragmentos con `roomSync.ts`. Fuente: `apps/backend/src/index.ts`, `apps/frontend/src/roomSync.ts`.
- Tests junto al codigo que validan helpers puros y reglas aisladas. Fuente: `apps/backend/src/*.test.ts`, `apps/frontend/src/*.test.ts`.
- No aplica: no se observaron scripts de linting ni formateo declarados en los manifests inspeccionados. Fuente: `apps/backend/package.json`, `apps/frontend/package.json`.

# Reglas de legibilidad

- Extraer reglas densas a helpers puros cuando no requieren acceso directo al socket o al estado global; esto ya ocurre con `finalScoring.ts`, `gameTiming.ts`, `roundParticipants.ts`, `roomSync.ts` y otros.
- Mantener el contrato publico/privado del estado de sala: cambios a `serializeRoom()`, `buildPrivateState()` o `createRoomSnapshot()` deben preservar que la mano completa no salga por broadcast masivo.
- Mantener envelopes versionados y marcas de tiempo para resync del cliente. Fuente: `createPublicRoomEnvelope`, `createPrivateStateEnvelope`, `createRoomSnapshot` en `apps/backend/src/index.ts`.
- Mantener logs y feedback acotados: el backend conserva los ultimos 50 logs y el cliente replica ese recorte. Fuente: `emitGameLog()` en `apps/backend/src/index.ts`, manejo de logs en `apps/frontend/src/App.tsx`.
- Incertidumbre: `apps/backend/src/index.ts` y `apps/frontend/src/App.tsx` siguen siendo archivos grandes con muchas responsabilidades; la legibilidad actual depende mas de helpers y nombres que de una separacion por features.

# Patrones usados

- Estado autoritativo en backend con Maps en memoria (`rooms`, `playerRoom`, `socketPlayer`) y timers por sala. Fuente: `apps/backend/src/index.ts`.
- Contrato realtime basado en eventos Socket.IO con `ack` opcional `{ ok, error?, ...data }`. Fuente: handlers de `apps/backend/src/index.ts`.
- Serializacion segura de datos privados mediante estado publico y privado separados. Fuente: `serializeRoom()`, `buildPrivateState()`, `emitRoomUpdate()` en `apps/backend/src/index.ts`.
- Locks temporales para transiciones de dealing, countdown, error, estrella y cierre de nivel. Fuente: `apps/backend/src/gameTiming.ts`, `apps/backend/src/index.ts`, `apps/frontend/src/gameUi.ts`.
- Reconexion por identidad estable en `localStorage` y rejoin por `playerId`. Fuente: `apps/frontend/src/App.tsx`, `apps/backend/src/index.ts` (`room:join`).
- Proxy de dev server para unificar origen de frontend y backend en local. Fuente: `apps/frontend/vite.config.ts`.
- Tests unitarios co-localizados sobre helpers puros. Fuente: archivos `*.test.ts` en ambos `src/`.

# Antipatrones evitados

- Evitar exponer manos privadas en `room:update`; el estado publico solo contiene `handCount`. Fuente: `serializeRoom()` en `apps/backend/src/index.ts`.
- Evitar que el cliente derive solo por su cuenta el estado de sala; el backend envia snapshots y acciones privadas ya autorizadas. Fuente: `createRoomSnapshot()` en `apps/backend/src/index.ts`, `buildPrivateActions()` en `apps/backend/src/privateState.ts`.
- Evitar dependencias de orquestacion innecesarias en desarrollo local; el flujo soportado sigue siendo `docker compose`, no scripts raiz adicionales. Fuente: `README.md`, `docker-compose.yml`.
- Evitar documentar dependencias transitivas como contrato del proyecto; esta regeneracion lista solo dependencias directas declaradas en los manifests de cada app.

# Paquetes instalados

| Paquete | Tipo | Proposito | Fuente |
| --- | --- | --- | --- |
| `@fastify/cors` | dependency | CORS configurable para HTTP y WebSocket en backend. | `apps/backend/package.json` |
| `fastify` | dependency | Servidor HTTP y endpoint `/health`. | `apps/backend/package.json`, `apps/backend/src/index.ts` |
| `socket.io` | dependency | Transporte realtime autoritativo del juego. | `apps/backend/package.json`, `apps/backend/src/index.ts` |
| `@types/node` | devDependency | Tipos Node para backend y frontend. | `apps/backend/package.json`, `apps/frontend/package.json` |
| `tsx` | devDependency | Ejecucion TS directa para `dev` y `test`. | `apps/backend/package.json`, `apps/frontend/package.json` |
| `typescript` | devDependency | Compilacion y chequeo de tipos. | `apps/backend/package.json`, `apps/frontend/package.json` |
| `react` | dependency | Libreria de UI del cliente. | `apps/frontend/package.json`, `apps/frontend/src/main.tsx` |
| `react-dom` | dependency | Renderizado DOM del cliente React. | `apps/frontend/package.json`, `apps/frontend/src/main.tsx` |
| `socket.io-client` | dependency | Conexion realtime del frontend al backend. | `apps/frontend/package.json`, `apps/frontend/src/App.tsx` |
| `@types/react` | devDependency | Tipos React para el frontend. | `apps/frontend/package.json` |
| `@types/react-dom` | devDependency | Tipos React DOM para el frontend. | `apps/frontend/package.json` |
| `@vitejs/plugin-react` | devDependency | Plugin React del dev server/build Vite. | `apps/frontend/package.json`, `apps/frontend/vite.config.ts` |
| `vite` | devDependency | Dev server, proxy local y build del frontend. | `apps/frontend/package.json`, `apps/frontend/vite.config.ts` |

# Comandos del proyecto

## Arranque

- `docker compose up --build`: flujo de desarrollo soportado para construir y arrancar todo el stack. Fuente: `README.md`, `docker-compose.yml`.
- `docker compose up`: arranca servicios usando imagenes ya construidas. Fuente: `README.md`.
- `docker compose down`: detiene el entorno local. Fuente: `README.md`.
- `npm run dev` en `apps/backend`: arranca backend con `tsx watch src/index.ts`. Fuente: `apps/backend/package.json`.
- `npm run dev` en `apps/frontend`: arranca Vite para frontend. Fuente: `apps/frontend/package.json`.
- `npm run build` y `npm run start` en `apps/backend`, y `npm run build` en `apps/frontend`: usados por el despliegue observado en `render.yaml`. Fuente: `apps/backend/package.json`, `apps/frontend/package.json`, `render.yaml`.

## Testing

- `npm test` en `apps/backend`: ejecuta `node --import tsx --test src/*.test.ts`. Fuente: `apps/backend/package.json`.
- `npm run test:coverage` en `apps/backend`: ejecuta cobertura experimental del test runner de Node. Fuente: `apps/backend/package.json`.
- `npm test` en `apps/frontend`: ejecuta `node --import tsx --test src/*.test.ts`. Fuente: `apps/frontend/package.json`.
- `npm run test:coverage` en `apps/frontend`: ejecuta cobertura experimental del test runner de Node. Fuente: `apps/frontend/package.json`.

## Linting

- No aplica: no hay scripts `lint` ni dependencias de ESLint/Prettier declaradas en `apps/backend/package.json` o `apps/frontend/package.json`.

# Contrato realtime baseline

## Entradas, ack y guardas

| Eventos | Payload | Ack y guardas |
| --- | --- | --- |
| `room:create`, `room:join` | identidad; join añade `roomCode` | `{ ok, snapshot, room, hand, yourId }`; identidad, sala, aforo y admisión |
| `room:leave`, `room:resync` | sin payload | `{ ok }` o snapshot; sin contexto: `You are not in a room` |
| `player:ready`, `room:kick`, `game:start`, `game:retry` | ready, target o vacío | `{ ok, error? }`; lock, host, lobby/fase y participante |
| `game:play-card`, `game:pause-request` | `{ card }` o vacío | mano, mínimo, fase/lock y participante activo |
| `star:propose`, `star:accept`, `star:cancel`, `star:reject`, `star:discard-animation-complete` | sin payload | fase, lock, propuesta, iniciador y contexto |
| `connection`, `disconnect` | Socket.IO | conecta o marca desconectado conservando jugador/mano |

## Emisiones, versiones y privacidad

| Evento | Destino/contenido |
| --- | --- |
| `room:update` | sala: `{ version, serverTime, publicState }` |
| `player:state`, `room:snapshot` | socket propietario; estado privado o combinado |
| `game:log` | sala; subtipos: room joined/left/reconnected/host-changed; game started/card-played/error/discard/paused/star-proposed/star-accepted/star-used/level-complete/reward/next-level-ready/over/victory/restarted |
| `room:kicked`, `game:started`, `game:error-penalty`, `game:paused`, `game:star-used`, `game:level-complete`, `game:next-level-ready`, `game:restarted`, `game:over` | socket expulsado o sala; payload específico |

Updates incrementan `version`; sus fragmentos comparten `serverTime`. Resync no incrementa versión; emisiones decorativas usan versión actual o siguiente según handler. `serializeRoom()` solo expone `handCount`, nunca mano o `socketId`; `buildPrivateState()` entrega mano/acciones solo al propietario. Cartas ya jugadas o descartadas son públicas. `rewardMap`, `startedAt`, `errorCounts`, Maps, timers y settlement de estrella son internos.

## Fases, timers, locks y test

Fases: `focus`, `playing`, `paused`, `round-complete`, `level-complete`, `game-over`, `victory`. Locks: `dealing` (`nivel * 460 + 80ms`), `countdown` (3000ms), `error`, `star` y `level-complete` (5000ms); cierre de ronda 520ms + 520ms y CPU 900ms. Ready excluye conectados sin cartas; consenso de estrella los incluye. `index.ts` exporta `startServer`, `stopServer` y `resetServerForTests`; producción conserva `Math.random`, escala 1, `0.0.0.0:$PORT`. Integración Socket.IO usa puerto 0, WebSocket, ack con timeout, RNG sembrado, predicados y cleanup de clientes/timers.
