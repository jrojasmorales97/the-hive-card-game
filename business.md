# Business Context

## Proposito Del Producto

The Hive es un juego cooperativo de cartas en tiempo real donde varias personas intentan jugar cartas en orden ascendente sin hablar ni darse señales. El objetivo del producto es reproducir una experiencia de sincronizacion compartida: los jugadores deben leer el ritmo del grupo y decidir cuando jugar su carta mas baja. Evidencia: `README.md:1-7` define el producto como "Juego cooperativo de cartas" y ubica backend, frontend y Docker; `README.md:36-42` enumera juego sin turnos, reglas de carta mas baja, penalizaciones, estrella, pausa y progresion.

La experiencia actual tambien incluye resumen final de sincronizacion por jugador, con puntuacion, clasificacion de timing y feedback textual. Evidencia: `apps/backend/src/finalScoring.ts:10-21` define `FinalPlayerResult`; `apps/backend/src/finalScoring.ts:97-190` calcula resultados finales; `plan.md:1-12` describe criterios de aceptacion para ranking final compartido.

## Contexto

El repo implementa una version web multijugador de The Hive con dos servicios principales: backend Fastify + Socket.IO y frontend React + Vite + TypeScript. Evidencia: `README.md:5-7`, `apps/backend/package.json:13-22`, `apps/frontend/package.json:13-26`.

El flujo de desarrollo soportado es Docker Compose. Evidencia: `README.md:9-23`, `AGENTS.md:5-20`, `docker-compose.yml:1-37`.

El despliegue observado contempla un backend Node como `web_service` y un frontend como `static_site` en Render. Evidencia: `render.yaml:1-22`.

Graphify actualizado en modo `update` muestra un grafo code-only con 125 nodos, 213 aristas y hubs principales en `startGameInRoom()`, `playCardInRoom()` y `App()`. Evidencia: salida de `graphify summary --graph .graphify/graph.json` tras `graphify update . --no-description --no-label`.

## Glosario

- Sala: contenedor de partida identificado por codigo; contiene host, jugadores, estado, juego y logs. Evidencia: tipo `Room` en `apps/backend/src/index.ts:55-70`.
- Jugador: participante humano o CPU con id, nombre, socket, conexion, ready y mano privada. Evidencia: tipo `Player` en `apps/backend/src/index.ts:13-21`.
- Host: jugador autorizado para iniciar o reintentar partida de forma explicita. Evidencia: `game:start` valida `ctx.room.hostId !== ctx.playerId` en `apps/backend/src/index.ts:1162-1180`; `game:retry` hace lo mismo en `apps/backend/src/index.ts:1183-1231`.
- Ready: estado de preparacion usado para auto-inicio en lobby y para reanudar foco/pausa. Evidencia: `player:ready` en `apps/backend/src/index.ts:1121-1160`.
- Carta: numero de 1 a 100 generado por `buildDeck()` y repartido segun nivel. Evidencia: `apps/backend/src/index.ts:246-252`, `apps/backend/src/index.ts:462-476`.
- Mano: cartas privadas de cada jugador; el snapshot publico expone solo `handCount`, y el backend envia la mano privada por `player:state`. Evidencia: `serializeRoom()` en `apps/backend/src/index.ts:139-185`; `emitRoomUpdate()` en `apps/backend/src/index.ts:187-199`.
- Pila: secuencia publica de cartas jugadas. Evidencia: `GameState.pile` y `pileHistory` en `apps/backend/src/index.ts:37-53`; insercion manual en `apps/backend/src/index.ts:608-610`.
- Vida: recurso compartido que baja con errores y provoca derrota al llegar a cero. Evidencia: `resolveErrorAndDiscard()` en `apps/backend/src/index.ts:561-566`; derrota en `apps/backend/src/index.ts:643-650`.
- Estrella: recurso cooperativo que requiere propuesta y consenso; al resolverse descarta la carta mas baja disponible de cada jugador con cartas, sin dejarla como jugada en la pila central. Evidencia: `resolveStarIfEveryoneAccepted()` en `apps/backend/src/index.ts:712-735`; `resolveStar()` en `apps/backend/src/index.ts:738-759`.
- Nivel: dificultad progresiva; cada jugador recibe `currentLevel` cartas, con recompensas en niveles concretos. Evidencia: `dealLevel()` en `apps/backend/src/index.ts:462-481`; `buildRewardMap()` en `apps/backend/src/index.ts:231-244`.
- Bloqueo de interaccion: intervalo temporal donde se impiden acciones durante reparto, countdown o error. Evidencia: `gameTiming.ts:1-24`; uso en `setInteractionLock()` en `apps/backend/src/index.ts:309-336`.
- Modo dev-cpu: sala con jugadores CPU activable por codigo `CPUON1` a `CPUON7`. Evidencia: `parseCpuRoomCode()` en `apps/backend/src/index.ts:885-889`; `createCpuRoom()` en `apps/backend/src/index.ts:891-920`.

## Actores

- Jugador humano: crea o se une a una sala, marca ready, juega cartas, pide pausa, propone/acepta estrella, abandona o reconecta. Evidencia: eventos Socket.IO `room:create`, `room:join`, `player:ready`, `game:play-card`, `game:pause-request`, `star:propose`, `star:accept`, `room:leave` en `apps/backend/src/index.ts:941-1408`.
- Host: jugador con permisos extra para iniciar y reintentar partidas. Evidencia: `apps/backend/src/index.ts:1162-1180`, `apps/backend/src/index.ts:1183-1231`.
- CPU: jugador simulado para desarrollo, marcado como `isCpu`, auto-ready y capaz de jugar si tiene la carta global mas baja. Evidencia: `markCpuPlayersReady()` en `apps/backend/src/index.ts:267-276`; `scheduleCpuTurn()` en `apps/backend/src/index.ts:665-695`; `calculateFinalResults()` trata CPU como sincronizado en `apps/backend/src/finalScoring.ts:121-136`.
- Sistema backend: autoridad de estado, reglas, penalizaciones, timers, logs y serializacion segura. Evidencia: Graphify identifica `startGameInRoom()` y `playCardInRoom()` como hubs; tipos y Maps en `apps/backend/src/index.ts:13-78`.
- Cliente frontend: interfaz de sala, estado local, reconexion, overlays y eventos de usuario. Evidencia: `App()` en `apps/frontend/src/App.tsx:565-844`; `SOCKET_URL` y `STORAGE_KEYS` en `apps/frontend/src/App.tsx:132-144`.

## Funcionalidades Principales

- Crear sala y unirse a sala con codigos. Evidencia: `room:create` en `apps/backend/src/index.ts:972-1014`; `room:join` en `apps/backend/src/index.ts:1016-1118`.
- Reconectar por identidad estable de jugador y resync de sala/mano. Evidencia: `room:join` reconecta si existe `existingPlayer` en `apps/backend/src/index.ts:1057-1082`; `room:resync` devuelve snapshot y mano en `apps/backend/src/index.ts:957-970`; frontend persiste `th:playerId`, `th:playerName`, `th:lastRoomCode` en `apps/frontend/src/App.tsx:140-144`, `apps/frontend/src/App.tsx:701-731`, `apps/frontend/src/App.tsx:787-811`.
- Ready y auto-inicio de partida cuando todos estan listos, con minimo 2 jugadores conectados. Evidencia: `canStartGame()` en `apps/backend/src/index.ts:379-383`; `player:ready` auto-inicia en `apps/backend/src/index.ts:1143-1147`.
- Inicio explicito por host. Evidencia: `game:start` en `apps/backend/src/index.ts:1162-1180`.
- Juego de cartas en tiempo real sin turnos, validando que cada jugador solo pueda jugar su carta propia mas baja. Evidencia: `playCardInRoom()` en `apps/backend/src/index.ts:568-663`, especialmente `apps/backend/src/index.ts:589-592`.
- Penalizacion automatica por jugar por encima de cartas menores ocultas en cualquier mano. Evidencia: deteccion de `blockingCards` en `apps/backend/src/index.ts:597-605`; perdida de vida y descarte en `apps/backend/src/index.ts:618-640`; helper probado en `apps/backend/src/gameTiming.test.ts:32-47`.
- Pausa cooperativa y reconcentracion, donde todos deben volver a ready para continuar. Evidencia: `game:pause-request` en `apps/backend/src/index.ts:1247-1282`; `player:ready` llama `beginRoundCountdown()` al estar todos listos en `apps/backend/src/index.ts:1150-1156`.
- Estrella ninja por consenso: proponer, aceptar y resolver cuando todos los participantes activos aceptan. Evidencia: `star:propose` en `apps/backend/src/index.ts:1285-1327`; `star:accept` en `apps/backend/src/index.ts:1329-1390`; `resolveStarIfEveryoneAccepted()` en `apps/backend/src/index.ts:712-737`.
- Progresion de niveles, recompensas, victoria y derrota. Evidencia: `completeLevelOrGame()` en `apps/backend/src/index.ts:483-528`; derrota por vidas en `apps/backend/src/index.ts:643-650`.
- Ranking final de sincronizacion. Evidencia: `finalizeGameResults()` en `apps/backend/src/index.ts:450-459`; calculo en `apps/backend/src/finalScoring.ts:97-190`; tests en `apps/backend/src/finalScoring.test.ts:12-147`.
- Modo de desarrollo con CPU. Evidencia: `parseCpuRoomCode()` en `apps/backend/src/index.ts:885-889`; `createCpuRoom()` en `apps/backend/src/index.ts:891-920`; `scheduleCpuTurn()` en `apps/backend/src/index.ts:665-695`.

## Reglas De Negocio

- Una sala admite hasta 8 jugadores. Evidencia: `MAX_PLAYERS = 8` en `apps/backend/src/index.ts:80`; validacion de sala llena en `apps/backend/src/index.ts:1090-1093`.
- El juego solo puede empezar con al menos 2 jugadores conectados y todos listos. Evidencia: `canStartGame()` en `apps/backend/src/index.ts:379-383`.
- El host es requerido para `game:start` y `game:retry`. Evidencia: `apps/backend/src/index.ts:1169-1177`, `apps/backend/src/index.ts:1190-1197`.
- La configuracion por cantidad de jugadores define vidas y nivel maximo: 2->12/2 vidas, 3->10/3, 4->8/4, 5->8/4, 6->7/5, 7->6/5, 8->5/5. Evidencia: `GAME_BALANCE` en `apps/backend/src/index.ts:80-89`.
- Cada nivel reparte a cada jugador tantas cartas como `currentLevel`. Evidencia: `dealLevel()` usa `deck.splice(0, level)` en `apps/backend/src/index.ts:462-476`.
- El mazo contiene cartas 1-100 y se baraja por nivel. Evidencia: `buildDeck()` en `apps/backend/src/index.ts:246-252`.
- Un jugador solo puede jugar una carta entera que este en su mano. Evidencia: validaciones en `apps/backend/src/index.ts:581-587`.
- Un jugador debe jugar su propia carta mas baja primero. Evidencia: `minCard` y error `Debes jugar tu carta mas baja primero` en `apps/backend/src/index.ts:589-592`.
- Si quedan cartas menores ocultas en cualquier mano, se pierde una vida, se descartan esas cartas y se emite `game:error-penalty`. Evidencia: `apps/backend/src/index.ts:597-640`; `discardLowerCards()` en `apps/backend/src/gameTiming.ts:26-36`.
- Con vidas en cero, la partida termina en `game-over` y se calculan resultados finales. Evidencia: `apps/backend/src/index.ts:643-650`.
- Al completar todas las cartas del nivel, se programa cierre de ronda y luego progreso de nivel o victoria. Evidencia: `scheduleLevelCompletionAfterRoundOut()` en `apps/backend/src/index.ts:531-559`; `completeLevelOrGame()` en `apps/backend/src/index.ts:483-528`.
- Las recompensas estan fijadas por nivel y se capan: estrellas maximo 3, vidas maximo 5. Evidencia: `buildRewardMap()` en `apps/backend/src/index.ts:231-244`; `applyLevelReward()` en `apps/backend/src/index.ts:435-443`.
- La estrella consume una estrella y descarta la menor carta de cada jugador con cartas, registrando el descarte via evento/log pero sin contaminar la pila visible. Evidencia: `resolveStar()` en `apps/backend/src/index.ts:738-759`; `resolveStarIfEveryoneAccepted()` en `apps/backend/src/index.ts:712-735`.
- La propuesta de estrella solo es valida durante `playing`, con estrellas disponibles y jugador activo. Evidencia: `star:propose` en `apps/backend/src/index.ts:1292-1310`.
- Los bloqueos temporales impiden acciones durante transiciones de reparto, countdown o error. Evidencia: `hasActiveInteractionLock()` en `apps/backend/src/index.ts:302-307`; checks en `playCardInRoom()` `apps/backend/src/index.ts:573-579`, `player:ready` `apps/backend/src/index.ts:1128-1137`, `star:propose` `apps/backend/src/index.ts:1297-1299`.
- El ranking final usa solo jugadas manuales para medir timing, penaliza errores y clasifica en bandas `sync`, `slightly-fast`, `very-fast`, `slightly-slow`, `very-slow` o `unrated`. Evidencia: `manualPlays` en `apps/backend/src/finalScoring.ts:104`; tipos en `apps/backend/src/finalScoring.ts:8-21`; clasificacion en `apps/backend/src/finalScoring.ts:53-60`; penalizacion en `apps/backend/src/finalScoring.ts:149-171`.

## Dudas Abiertas O Incertidumbres

- No existen `templates/business.md` ni `templates/architecture.md` en el repo; la estructura de este documento sigue las secciones solicitadas por el comando, no una plantilla versionada. Evidencia: busqueda `templates/*.md` sin resultados.
- El grafo actualizado con `graphify update . --no-description --no-label` es code-only; varias consultas documentales devolvieron `No matching nodes found`, por lo que README, AGENTS, configs y plan se verificaron por lectura directa despues de consultar Graphify.
- El README dice "Fase 1 + base de Fase 2" y lista "proximas fases" como modo ciego y endurecer reglas avanzadas. Puede estar parcialmente desactualizado frente a scoring final ya implementado. Evidencia: `README.md:24-51` y `apps/backend/src/finalScoring.ts:97-190`.
- `plan.md` declara en `plan.md:75-76` que no existian `business.md` ni `architecture.md`; esta regeneracion cambia ese hecho.
- El modo CPU esta implementado como modo de desarrollo por codigos `CPUON[1-7]`, pero no aparece descrito en README como funcionalidad publica. Evidencia: `apps/backend/src/index.ts:885-920`; ausencia en `README.md:24-47`.
- No se observa persistencia durable; todo el estado de salas vive en memoria. Esto limita recuperacion ante reinicio de backend. Evidencia: Maps globales en `apps/backend/src/index.ts:72-78` y ausencia de dependencias de base de datos en `apps/backend/package.json:13-22`.
