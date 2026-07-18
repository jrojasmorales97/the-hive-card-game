# Proposito del proyecto

The Hive es una implementacion web de un juego cooperativo de cartas en tiempo real donde varias personas deben jugar sus cartas en orden ascendente sin hablar ni darse senales, apoyandose en un ritmo compartido y en la lectura del grupo. La definicion base aparece en `README.md`, mientras que la logica autoritativa actual vive en `apps/backend/src/index.ts` y el cliente en `apps/frontend/src/App.tsx`.

# Contexto funcional

- El producto actual esta dividido en un backend Fastify + Socket.IO (`apps/backend`) y un frontend React + Vite (`apps/frontend`), coordinados en desarrollo por `docker-compose.yml`.
- El backend mantiene el estado de salas y partidas en memoria mediante `rooms`, `playerRoom` y `socketPlayer` dentro de `apps/backend/src/index.ts`; no se observo persistencia durable ni base de datos declarada en `apps/backend/package.json`.
- La experiencia ya cubre lobby multijugador, reconexion, ready cooperativo, juego sin turnos, penalizacion por errores, pausa, estrella por consenso, progresion de niveles, derrota, victoria y ranking final de sincronizacion. La mayor parte de esas reglas esta implementada en `apps/backend/src/index.ts`, con helpers aislados en `finalScoring.ts`, `gameTiming.ts`, `roundParticipants.ts`, `roundResolution.ts`, `starResolution.ts`, `lobbyRules.ts` y `privateState.ts`.
- El frontend conserva una sola pantalla principal en `apps/frontend/src/App.tsx` y apoya la UI con helpers puros como `roomSync.ts`, `connectionStatus.ts`, `gameUi.ts`, `lobbyUi.ts`, `handLayout.ts`, `starUi.ts`, `finalScoreUi.ts` y `messageTiming.ts`.
- `README.md` aun presenta el producto como "Fase 1 + base de Fase 2" y marca "Modo ciego" y "endurecer reglas avanzadas y anadir tests de motor" como trabajo futuro; esa documentacion parece parcialmente desactualizada frente a funcionalidades ya presentes como scoring final y modo CPU de desarrollo.

# Log de requerimientos

| Fecha | Requerimiento | Estado | Fuente |
| --- | --- | --- | --- |
| Desconocido | Soportar una experiencia cooperativa de cartas en tiempo real donde las cartas se juegan en orden ascendente sin comunicacion explicita. | Implementado | `README.md`, `apps/backend/src/index.ts` (`playCardInRoom`, `buildDeck`) |
| Desconocido | Permitir crear sala, unirse, abandonar, expulsar desde lobby y reconectar usando identidad persistente del jugador. | Implementado | `apps/backend/src/index.ts` (`room:create`, `room:join`, `room:leave`, `room:kick`, `room:resync`), `apps/frontend/src/App.tsx` (`STORAGE_KEYS`, auto-join) |
| Desconocido | Requerir ready cooperativo para iniciar o reanudar rondas, con host como actor explicito para inicio y retry. | Implementado | `apps/backend/src/index.ts` (`player:ready`, `game:start`, `game:retry`), `apps/backend/src/roundParticipants.ts`, `apps/backend/src/lobbyRules.ts` |
| Desconocido | Aplicar penalizacion de vida y descarte automatico cuando se juegue por encima de cartas menores aun ocultas. | Implementado | `apps/backend/src/index.ts` (`playCardInRoom`), `apps/backend/src/gameTiming.ts` (`discardLowerCards`) |
| Desconocido | Resolver una estrella solo por consenso y descartar la carta mas baja de cada jugador con cartas. | Implementado | `apps/backend/src/index.ts` (`star:propose`, `star:accept`, `star:cancel`, `star:reject`, `resolveStarIfEveryoneAccepted`) |
| Desconocido | Mostrar un ranking final de sincronizacion con puntuacion, banda de timing y feedback textual por jugador. | Implementado | `apps/backend/src/finalScoring.ts`, `apps/backend/src/index.ts` (`finalizeGameResults`), `apps/frontend/src/finalScoreUi.ts` |
| Desconocido | Ofrecer un modo ciego de juego boca abajo con validacion al final del nivel. | Pendiente | `README.md` |
| Desconocido | Endurecer reglas avanzadas y anadir tests de motor. | Pendiente | `README.md` |
| 2026-07-18 | Inicio manual por host sin ready previo; contradice README. | Por confirmar | `index.ts` (`game:start`), `lobbyRules.ts` |
| 2026-07-18 | `availableActions` es consejo UI; handlers siguen siendo autoridad. | Por confirmar | `privateState.ts`, handlers |
| 2026-07-18 | Desconectados conservan cartas sin TTL; identidad por `playerId` y host migran. | Por confirmar | `markSocketDisconnected`, `room:join`, `pickNextHost` |
| 2026-07-18 | Balance, ready y consenso usan criterios distintos de registro/conexión/cartas. | Por confirmar | `startGameInRoom`, `roundParticipants.ts`, estrella |
| 2026-07-18 | Leave en partida, scoring, versiones, estrella tras disconnect y terminales son ambiguos. | Por confirmar | `index.ts` |
| 2026-07-18 | `room:kick` solo está implementado en backend. | Por confirmar | `index.ts` |

# Funcionalidades

- Lobby y presencia: crear sala, unirse, expulsar, detectar host, mostrar jugadores conectados y logs de sala; evidencia en `apps/backend/src/index.ts` y helpers de UI en `apps/frontend/src/lobbyUi.ts`.
- Reconexion y resync: el cliente persiste `playerId`, `playerName` y ultima sala; el backend admite rejoin por `playerId` y devuelve snapshots versionados mediante `room:resync`; evidencia en `apps/frontend/src/App.tsx` y `apps/backend/src/index.ts`.
- Estado publico y estado privado: `serializeRoom()` publica solo datos seguros como `handCount`, mientras `buildPrivateState()` y `player:state` entregan la mano y acciones disponibles por socket; evidencia en `apps/backend/src/index.ts` y `apps/backend/src/privateState.ts`.
- Rondas cooperativas: countdown, locks de interaccion, foco, juego activo, pausa y reanudacion por ready; evidencia en `apps/backend/src/index.ts`, `apps/backend/src/gameTiming.ts`, `apps/backend/src/roundParticipants.ts` y `apps/frontend/src/gameUi.ts`.
- Regla de carta mas baja: cada jugador solo puede jugar una carta que este en su mano y que sea su minimo actual; evidencia en `apps/backend/src/index.ts` (`playCardInRoom`).
- Penalizacion por error: si existen cartas menores ocultas, se pierde una vida, se descartan las cartas bloqueantes y se emite `game:error-penalty`; evidencia en `apps/backend/src/index.ts` y `apps/backend/src/gameTiming.ts`.
- Estrella cooperativa: propuesta, aceptacion, cancelacion por el proponente y rechazo por otros jugadores, con resolucion sincronizada y animacion de descarte; evidencia en `apps/backend/src/index.ts`, `apps/backend/src/starResolution.ts` y `apps/frontend/src/starUi.ts`.
- Progresion de niveles: reparto proporcional al nivel, recompensas por mapa fijo, tope de vidas/estrellas, derrota por vidas y victoria al completar `maxLevel`; evidencia en `apps/backend/src/index.ts` (`GAME_BALANCE`, `buildRewardMap`, `completeLevelOrGame`).
- Ranking final: calculo de desviacion temporal, penalizacion por errores y feedback final por jugador; evidencia en `apps/backend/src/finalScoring.ts` y `apps/frontend/src/finalScoreUi.ts`.
- Modo dev-cpu: codigos `CPUON1` a `CPUON7` crean salas con CPU auto-ready para pruebas; evidencia en `apps/backend/src/index.ts` (`parseCpuRoomCode`, `createCpuRoom`, `scheduleCpuTurn`).
- Ready baseline: `game:start` es manual por host; en `focus`/`paused` solo conectados con cartas participan. Sin cartas no bloquea ready pero sí participa en consenso de estrella.
- Privacidad: broadcasts revelan contadores, pila e historial ya revelado; mano y acciones son privadas. `rewardMap`, `startedAt`, `errorCounts`, Maps, timers y resoluciones pendientes son internos.

# Glosario de terminos

| Termino | Definicion | Evidencia |
| --- | --- | --- |
| Sala | Contenedor de partida con codigo, host, jugadores, logs, version y estado de juego. | `apps/backend/src/index.ts` (`type Room`) |
| Jugador | Participante humano o CPU con identidad estable, conexion, ready y mano privada. | `apps/backend/src/index.ts` (`type Player`) |
| Host | Jugador con permisos para iniciar o reintentar la partida y expulsar en lobby. | `apps/backend/src/index.ts` (`game:start`, `game:retry`, `room:kick`) |
| Ready | Estado de preparacion usado para auto-inicio en lobby y para reanudar rondas despues de foco o pausa. | `apps/backend/src/index.ts` (`player:ready`), `apps/backend/src/roundParticipants.ts` |
| Pila | Secuencia publica de cartas ya jugadas, separada del historial detallado `pileHistory`. | `apps/backend/src/index.ts` (`GameState.pile`, `GameState.pileHistory`) |
| Vida | Recurso compartido que baja con errores y provoca derrota al llegar a cero. | `apps/backend/src/index.ts` (`completeLevelOrGame`, manejo de error en `playCardInRoom`) |
| Estrella | Recurso cooperativo consumible por consenso para descartar la carta mas baja de cada jugador con cartas. | `apps/backend/src/index.ts` (`star:*`, `resolveStarIfEveryoneAccepted`) |
| Bloqueo de interaccion | Ventana temporal donde acciones como ready, jugar o estrella se rechazan por transicion activa. | `apps/backend/src/gameTiming.ts`, `apps/backend/src/index.ts` (`hasActiveInteractionLock`) |
| Snapshot de sala | Envelope versionado que combina `publicState` y `privateState` para mantener sincronizado al cliente. | `apps/backend/src/index.ts` (`createRoomSnapshot`), `apps/frontend/src/roomSync.ts` |
| Modo dev-cpu | Variante de desarrollo donde el backend agrega jugadores CPU y programa sus jugadas automaticamente. | `apps/backend/src/index.ts` (`parseCpuRoomCode`, `createCpuRoom`, `scheduleCpuTurn`) |
