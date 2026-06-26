# Architecture

## Stack

- Backend: Node.js ESM con TypeScript, Fastify, `@fastify/cors` y Socket.IO. Evidencia: imports en `apps/backend/src/index.ts:1-4`; dependencias en `apps/backend/package.json:13-22`; `type: module` en `apps/backend/package.json:5`.
- Frontend: React 18, React DOM, Socket.IO Client, Vite y TypeScript. Evidencia: imports en `apps/frontend/src/main.tsx:1-4`; dependencias en `apps/frontend/package.json:13-26`; `vite.config.ts:1-22`.
- Runtime de desarrollo: Docker Compose con servicios `backend`, `frontend` y `tunnel`. Evidencia: `docker-compose.yml:1-37`; `AGENTS.md:5-20`.
- Dockerfiles de desarrollo: ambos servicios usan `node:20-alpine`, instalan dependencias con `npm install` y ejecutan scripts dev. Evidencia: `apps/backend/Dockerfile:1-12`; `apps/frontend/Dockerfile:1-12`.
- Despliegue observado: Render con backend `web_service` Node y frontend `static_site`. Evidencia: `render.yaml:1-22`.
- Testing: Node test runner con `tsx`; cobertura con `--experimental-test-coverage`. Evidencia: scripts en `apps/backend/package.json:6-11` y `apps/frontend/package.json:6-11`.

## Capas Y Modulos

Graphify identifica 125 nodos, 213 aristas y hubs principales en `startGameInRoom()`, `playCardInRoom()` y `App()`. Evidencia: `graphify summary --graph .graphify/graph.json` despues de `graphify update . --no-description --no-label`.

- Backend monolitico principal: `apps/backend/src/index.ts` contiene servidor HTTP, Socket.IO, estado en memoria, reglas de juego, timers y handlers de eventos. Evidencia: `AGENTS.md:22-27`; Graphify query ubica `index.ts`, `startGameInRoom()`, `playCardInRoom()`, `serializeRoom()`, `resolveStarIfEveryoneAccepted()`; codigo en `apps/backend/src/index.ts:1-1410`.
- Backend helper de timing: `apps/backend/src/gameTiming.ts` encapsula locks, duracion de reparto y descarte de cartas menores. Evidencia: `apps/backend/src/gameTiming.ts:1-36`; tests en `apps/backend/src/gameTiming.test.ts:13-47`.
- Backend helper de scoring: `apps/backend/src/finalScoring.ts` calcula resultados finales y clasifica timing. Evidencia: `apps/backend/src/finalScoring.ts:1-191`; tests en `apps/backend/src/finalScoring.test.ts:12-147`.
- Frontend monolitico principal: `apps/frontend/src/App.tsx` concentra conexion Socket.IO, estado React, UI, overlays, reconexion y acciones de usuario. Evidencia: `AGENTS.md:24-28`; Graphify explain `App()` indica fuente `apps/frontend/src/App.tsx L565` y llamadas a helpers visuales; codigo en `apps/frontend/src/App.tsx:565-844`.
- Frontend helper de conexion: `apps/frontend/src/connectionStatus.ts` deriva estados `connected`, `syncing`, `reconnecting`, `disconnected` y etiquetas/iconos. Evidencia: `apps/frontend/src/connectionStatus.ts:1-39`; tests en `apps/frontend/src/connectionStatus.test.ts:6-46`.
- Frontend helper de UI de juego: `apps/frontend/src/gameUi.ts` modela locks visuales, countdown y reparto. Evidencia: `apps/frontend/src/gameUi.ts:1-32`; tests en `apps/frontend/src/gameUi.test.ts:11-35`.
- Entrada frontend: `apps/frontend/src/main.tsx` monta `<App />` bajo `React.StrictMode`. Evidencia: `apps/frontend/src/main.tsx:1-10`.

## Patrones Preferidos

- Estado autoritativo en backend: el backend mantiene `rooms`, `playerRoom`, `socketPlayer` y timers como Maps globales; el cliente recibe snapshots y mano privada. Evidencia: `apps/backend/src/index.ts:72-78`; `emitRoomUpdate()` en `apps/backend/src/index.ts:187-199`.
- Serializacion segura de sala: `serializeRoom()` no expone manos completas en `room:update`, solo `handCount`; la mano privada se emite por socket individual en `player:state`. Evidencia: `apps/backend/src/index.ts:139-199`; `AGENTS.md:29-38`.
- Contrato Socket.IO con ack opcional y respuesta `{ ok, error?, ...data }`. Evidencia: `AGENTS.md:39-56`; handlers en `apps/backend/src/index.ts:941-1408` usan `ack?.({ ok: ... })`.
- Flujos de juego encapsulados en funciones con efectos explicitos: `startGameInRoom()`, `playCardInRoom()`, `completeLevelOrGame()`, `resolveStarIfEveryoneAccepted()`, `scheduleCpuTurn()`. Evidencia: Graphify explain muestra conexiones de estos hubs; fuentes en `apps/backend/src/index.ts:390`, `apps/backend/src/index.ts:568`, `apps/backend/src/index.ts:483`, `apps/backend/src/index.ts:712`, `apps/backend/src/index.ts:665`.
- Locks temporales como mecanismo unico para bloquear interacciones durante transiciones. Evidencia: `createInteractionLock()` y `isInteractionLockActive()` en `apps/backend/src/gameTiming.ts:11-24`; `setInteractionLock()` en `apps/backend/src/index.ts:309-336`; helper espejo en frontend `apps/frontend/src/gameUi.ts:8-24`.
- Reconexion por identidad estable en `localStorage` y rejoin por `playerId`. Evidencia: `STORAGE_KEYS` y `getOrCreateStablePlayerId()` en `apps/frontend/src/App.tsx:140-209`; rejoin backend en `apps/backend/src/index.ts:1057-1082`.
- Helpers puros testeables para logica aislada. Evidencia: `finalScoring.ts`, `gameTiming.ts`, `connectionStatus.ts`, `gameUi.ts` y sus tests dedicados.

## Convenciones De Codigo

- TypeScript estricto en ambos proyectos. Evidencia: `strict: true` en `apps/backend/tsconfig.json:2-13` y `apps/frontend/tsconfig.json:2-17`.
- Backend usa `module` y `moduleResolution` `NodeNext`, imports ESM con extension `.js` para modulos TS compilados. Evidencia: `apps/backend/tsconfig.json:3-11`; imports `./finalScoring.js` y `./gameTiming.js` en `apps/backend/src/index.ts:4-11`.
- Frontend usa `moduleResolution: Bundler`, JSX `react-jsx`, `noEmit: true`. Evidencia: `apps/frontend/tsconfig.json:2-17`.
- No hay router ni libreria de estado en frontend; estado local con `useState`/`useRef` dentro de `App()`. Evidencia: `AGENTS.md:24-28`; `apps/frontend/src/App.tsx:565-621`.
- El backend agrupa dominio y transporte en un solo archivo, con tipos al inicio, constantes globales, helpers y handlers Socket.IO. Evidencia: `apps/backend/src/index.ts:13-78`, `apps/backend/src/index.ts:119-940`, `apps/backend/src/index.ts:941-1408`.
- Los logs de juego se limitan a los ultimos 50 eventos. Evidencia: `emitGameLog()` en `apps/backend/src/index.ts:201-217`; frontend replica slice de 50 en `pushLog()` `apps/frontend/src/App.tsx:647-652`.
- Mensajes de usuario combinan espanol en errores backend y texto de UI/copy en ingles en frontend/scoring. Evidencia: errores como `No estas en una sala` en `apps/backend/src/index.ts:942-1282`; mensajes `MSG` en `apps/frontend/src/App.tsx:167-181`; feedback en `apps/backend/src/finalScoring.ts:62-95`.

## Estrategia De Testing

- Se usan pruebas unitarias con `node:test` y `node:assert/strict`; no se observa framework de test adicional. Evidencia: imports en `apps/backend/src/finalScoring.test.ts:1-4`, `apps/backend/src/gameTiming.test.ts:1-11`, `apps/frontend/src/connectionStatus.test.ts:1-4`, `apps/frontend/src/gameUi.test.ts:1-9`; package scripts `test` en ambos `package.json`.
- Backend cubre scoring final y timing/descarte. Evidencia: `apps/backend/src/finalScoring.test.ts:12-147`; `apps/backend/src/gameTiming.test.ts:13-47`.
- Frontend cubre helpers puros de estado de conexion e interacciones UI, no componentes React completos. Evidencia: `apps/frontend/src/connectionStatus.test.ts:6-46`; `apps/frontend/src/gameUi.test.ts:11-35`.
- Existen scripts de cobertura en ambos paquetes, pero no se observa configuracion de umbrales automatizados de cobertura. Evidencia: `test:coverage` en `apps/backend/package.json:10` y `apps/frontend/package.json:10`; ausencia de archivos de configuracion de coverage en los paths inspeccionados.
- No se observan tests end-to-end ni tests de integracion Socket.IO en el repo actual. Evidencia: busqueda de `**/*.{test,spec}.ts` devolvio solo cuatro tests unitarios.

## Dependencias Clave

- `fastify`: servidor HTTP y endpoint `/health`. Evidencia: `apps/backend/src/index.ts:1`, `apps/backend/src/index.ts:101-108`, `apps/backend/package.json:15`.
- `@fastify/cors`: CORS para HTTP y Socket.IO configurable por `CLIENT_ORIGIN`. Evidencia: `apps/backend/src/index.ts:2`, `apps/backend/src/index.ts:91-116`, `apps/backend/package.json:14`.
- `socket.io`: canal realtime del juego. Evidencia: `apps/backend/src/index.ts:3`, `apps/backend/src/index.ts:111-117`, `apps/backend/package.json:16`.
- `react` y `react-dom`: UI del cliente. Evidencia: `apps/frontend/src/main.tsx:1-10`, `apps/frontend/package.json:14-15`.
- `socket.io-client`: conexion realtime desde `App()`. Evidencia: `apps/frontend/src/App.tsx:3`, `apps/frontend/src/App.tsx:736-742`, `apps/frontend/package.json:16`.
- `vite` y `@vitejs/plugin-react`: dev server/build frontend y proxy de `/socket.io` y `/health`. Evidencia: `apps/frontend/vite.config.ts:1-22`, `apps/frontend/package.json:22-25`.
- `tsx`: ejecucion dev backend y tests TypeScript sin build previo. Evidencia: scripts en `apps/backend/package.json:7-10`, `apps/frontend/package.json:9-10`; devDependency en ambos paquetes.

## Anti-Patterns Observados

- Aplicaciones monoliticas de archivo unico: `index.ts` y `App.tsx` concentran demasiadas responsabilidades. Esta es una decision documentada, pero aumenta el coste de mantenimiento. Evidencia: `AGENTS.md:22-28`; `apps/backend/src/index.ts` tiene 1410 lineas; `apps/frontend/src/App.tsx` tiene 2202 lineas.
- Estado solo en memoria: no hay base de datos ni persistencia durable, por lo que reiniciar backend elimina salas y partidas. Evidencia: Maps globales en `apps/backend/src/index.ts:72-78`; dependencias backend sin DB en `apps/backend/package.json:13-22`.
- Contratos Socket.IO no estan tipados de extremo a extremo; muchos `ack` son `(response: unknown) => void` y el frontend usa `response: any`. Evidencia: `apps/backend/src/index.ts:941-1408`; `apps/frontend/src/App.tsx:787-811`.
- Duplicacion parcial de conceptos de lock entre backend y frontend. Evidencia: `InteractionLockReason` en `apps/backend/src/gameTiming.ts:1-6` y `apps/frontend/src/gameUi.ts:1-6`.
- Duplicacion de mapa de recompensas entre backend y frontend. Evidencia: `buildRewardMap()` en `apps/backend/src/index.ts:231-244`; `REWARDS` en `apps/frontend/src/App.tsx:158-165`.
- README posiblemente desactualizado respecto a scoring final, CPU y semantica actual de estrella. Evidencia: README lista "Fase 1 + base de Fase 2" y proximas fases en `README.md:24-51`; scoring y CPU existen en `apps/backend/src/finalScoring.ts:97-190` y `apps/backend/src/index.ts:885-920`; estrella ahora descarta en `apps/backend/src/index.ts:712-759`.
- Dockerfiles de repo ejecutan dev server, mientras `render.yaml` espera `npm run build` y `npm run start` para backend/static build para frontend; esto no es necesariamente incorrecto, pero son rutas operativas distintas que conviene mantener explicitas. Evidencia: `apps/backend/Dockerfile:1-12`, `apps/frontend/Dockerfile:1-12`, `render.yaml:1-22`.

## Ausencias Observadas

- No hay `templates/business.md` ni `templates/architecture.md`; esta documentacion usa la estructura solicitada por el comando. Evidencia: busqueda `templates/*.md` sin resultados.
- No hay router frontend, state management externo ni carpeta de componentes. Evidencia: `AGENTS.md:24-28`; Graphify muestra `App.tsx` como hub principal de frontend.
- No hay base de datos, ORM, migraciones ni jobs externos observados. Evidencia: dependencias backend en `apps/backend/package.json:13-22`; estado en Maps en `apps/backend/src/index.ts:72-78`.
- No hay tests E2E observados. Evidencia: busqueda de tests devuelve solo `finalScoring.test.ts`, `gameTiming.test.ts`, `connectionStatus.test.ts`, `gameUi.test.ts`.
- No hay package root observado; los scripts viven por paquete en `apps/backend/package.json` y `apps/frontend/package.json`. Evidencia: busqueda `**/package.json` devolvio solo esos dos paths.
