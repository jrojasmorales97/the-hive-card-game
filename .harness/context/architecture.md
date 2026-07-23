# Stack

- Backend: Node.js ESM + TypeScript + Fastify + `@fastify/cors` + Socket.IO. Fuente: `apps/backend/package.json`, `apps/backend/src/index.ts`, `apps/backend/tsconfig.json`.
- Frontend: React 18 + React DOM + Socket.IO Client + Vite + TypeScript. Fuente: `apps/frontend/package.json`, `apps/frontend/src/main.tsx`, `apps/frontend/src/App.tsx`, `apps/frontend/vite.config.ts`.
- Desarrollo local soportado: Docker Compose con servicios `backend`, `frontend` y `tunnel`. Fuente: `docker-compose.yml`, `README.md`.
- Despliegue observado: Render con backend `web_service` y frontend `static_site`. Fuente: `render.yaml`.
- Testing: `node --test` ejecutado via `tsx`, con variantes de cobertura por paquete. Fuente: `apps/backend/package.json`, `apps/frontend/package.json`.

# Capas

- Orquestacion de repo: documentacion raiz y Compose en `README.md`, `docker-compose.yml`, `render.yaml`, `business.md` y `architecture.md`.
- Backend autoritativo: `apps/backend/src/index.ts` es composition root y lifecycle de Fastify/Socket.IO; construye infraestructura, casos de uso y registros de transporte.
- Backend helper: `application/` orquesta comandos y efectos, `infrastructure/` posee repositorio, reloj, azar y scheduler, y `transport/socket/` conserva parsers, sesión, presenters, publisher y handlers. Las reglas viven en `src/domain/`.
- Frontend shell: `apps/frontend/src/main.tsx` monta `App`, mientras `apps/frontend/src/App.tsx` concentra conexion Socket.IO, estado React, overlays y acciones del usuario.
- Frontend helper: `apps/frontend/src/*.ts` extrae logica pura de sincronizacion, layout, copy y UI (`roomSync.ts`, `connectionStatus.ts`, `gameUi.ts`, `lobbyUi.ts`, `handLayout.ts`, `starUi.ts`, `finalScoreUi.ts`, `messageTiming.ts`).
- Tests co-localizados: backend y frontend guardan tests unitarios junto a los modulos en `apps/backend/src/*.test.ts` y `apps/frontend/src/*.test.ts`.
- Límite de dominio: `apps/backend/src/domain/` contiene datos y decisiones puras. `setup.ts` recibe mazo/reloj/duraciones; `round.ts` ready/pausa/countdown; `cards.ts` jugada/penalización/descartes; `star.ts` consenso/preview/settlement; `progression.ts` recompensas, avance, locks de nivel y terminales; `scoring.ts` ranking con tiempo inyectado. `StarUseCases` coordina acks visuales persistidos sin sockets y `index.ts` solo compone dependencias.

# Estrategia de carpetas

- Estado actual backend: `apps/backend/src/index.ts` es entrypoint de composición; `src/domain/`, `src/application/`, `src/infrastructure/` y `src/transport/` tienen propietarios separados.
- Estado actual frontend: `apps/frontend/src/main.tsx` arranca la app, `src/App.tsx` concentra conexion, estado, animacion y UI, los helpers/tests estan planos bajo `src/` y `src/styles.css` conserva la cascada global.
- `packages/contracts/`: paquete ESM local `@the-hive/contracts`, fuente canónica de wire types, parsers runtime y mapas Socket.IO. Se divide por estado, acciones, logs y familias de eventos; no contiene estado interno ni reglas de juego.
- `.harness/`: artefactos SDD y templates de regeneracion (`templates/`, `context/`, `plans/`, `implementations/`, `reviews/`).
- `.opencode/`: configuracion local de agentes, comandos y skills; la skill de proyecto observada es `ux-ui-design`.
- Raiz del repo: documentos de contexto (`README.md`, `business.md`, `architecture.md`) y orquestacion (`docker-compose.yml`, `render.yaml`).
- No aplica: no se observo `package.json` en raiz; los manifests viven por aplicacion en `apps/backend/package.json` y `apps/frontend/package.json`.

Las estructuras siguientes son el objetivo incremental de las fases pendientes del roadmap, no una afirmacion de que todas esas rutas existan hoy. Cada slice mueve un unico propietario, actualiza imports y borra la ruta anterior en el mismo estado estable.

## Backend objetivo: capas alrededor del dominio

El backend se organiza por direccion de dependencias porque combina reglas, casos de uso, efectos de proceso y dos transportes. No replica features visuales ni crea un archivo o interfaz por operacion.

```text
apps/backend/src/
  index.ts                         # composition root y lifecycle
  domain/                          # estado, reglas, eventos y maquina canonica
    model.ts
    result.ts
    stateMachine.ts
    participants.ts
    setup.ts
    round.ts
    cards.ts
    star.ts
    progression.ts
    scoring.ts
  application/                     # casos de uso y puertos requeridos
    roomUseCases.ts
    gameUseCases.ts
    starUseCases.ts
    effectUseCases.ts
    playerView.ts
    domainAdapter.ts
    ports/
  infrastructure/                  # implementaciones concretas de puertos
    memory/
    runtime/
    scheduling/
    cpu/
    effects/
  transport/                       # validacion wire, acks, presenters y emisiones
    http/
    socket/
  tooling/                         # checks y reporters ejecutados por scripts
```

 - `domain/stateMachine.ts` es la ubicacion canónica de la maquina; `domain/room.ts` posee las reglas puras de admision y expulsión. No existen rutas planas de compatibilidad.
- `application/` importa `domain/` y declaraciones bajo `application/ports/`; no importa Fastify, Socket.IO ni implementaciones de `infrastructure/`. Sus cinco puertos son repositorio, publisher, reloj, random y scheduler.
- Los puertos se crean por dependencia externa real, no por funcion. Repositorio de salas, reloj, random/barajado, scheduler y publicacion de eventos son limites candidatos; no se exige una interfaz si una funcion inyectada expresa el limite completo.
- `infrastructure/` implementa puertos y puede usar `Map`, reloj real, random y timers; no decide fases, elegibilidad, recursos, progreso ni outcomes.
- `transport/socket/registerRoomHandlers.ts` y `registerGameHandlers.ts` conocen parsers wire, Socket.IO y los casos de uso; solo validan, resuelven sesión activa, invocan aplicación y traducen el ack.
- `transport/socket/roomPresenter.ts` es el único proyector de `ApplicationRoom` a envelopes de contracts: el broadcast público expone contadores y nunca mano ni `socketId`; el envelope privado se calcula solo para la identidad conectada. `socketEventPublisher.ts` publica una vez los eventos comprometidos y conserva el orden update/snapshots/log; `sessionRegistry.ts` es el único propietario de `socket.id -> playerId -> roomCode` y rechaza disconnects stale.
- `index.ts` construye repositorio, publisher, scheduler y registros de transporte, y conserva lifecycle, HTTP y composición.
- Los casos de uso se agrupan por familia mientras sean cohesivos. Se divide un modulo solo por variacion o tamano real; se evitan carpetas `services/`, `helpers/`, `managers/` y `utils/` sin propietario claro.
- Los tests unitarios se colocan junto al modulo; la integracion Socket.IO vive junto al adaptador socket y los checks de limites junto a `tooling/`. Los scripts deben descubrir tests recursivamente antes de moverlos.
- Direccion permitida: `transport -> application -> domain`; `infrastructure -> application`; `index.ts -> transport + application + infrastructure`. Cualquier otra arista entre capas requiere documentacion explicita.

`application/roomUseCases.ts` recibe solamente `roomCode`, `playerId` y datos normalizados para sala y presencia. `application/gameUseCases.ts` recibe los mismos identificadores para inicio/retry/ready/pausa/jugada y usa `Clock`/`RandomSource` inyectados. `application/starUseCases.ts` recibe los cinco comandos de estrella sin sockets. `ApplicationResult` separa rechazo sin efectos de éxito con cambios/eventos/efectos. El dispatcher publica eventos ordenados después del commit y programa cada efecto por su `{ roomCode, trigger }` estable. `application/effectUseCases.ts` recibe la copia original de todos los triggers, incluido `star-settled`, exige versión esperada y deja que el dominio valide fase, lock y deadline. La espera de estrella se guarda en `ApplicationRoom` como efecto original más humanos pendientes/acknowledged: ack, desconexión y deadline usan esa misma clave y llegan al único settlement. `ProcessScheduler` reemplaza cada clave y CPU vuelve a seleccionar su carta dentro de `domain/cards.ts`, nunca en infraestructura. El publisher materializa la pausa manual en orden snapshot, `game:paused`, log; ninguna expiración o pausa automática genera ese evento. `tooling/testFiles.ts` inventaría recursivamente los tests y `tooling/layerBoundaries.ts` comprueba `application -> domain` y las importaciones prohibidas; `check:domain` sigue siendo el alias compatible de `check:layers`.

## Frontend objetivo: app y features verticales

El frontend se organiza por ownership de sesion y experiencia visible, no copiando las capas del backend. Socket.IO y la correlacion de snapshots son horizontales de aplicacion; la presentacion se divide en pocas features verticales.

```text
apps/frontend/src/
  main.tsx
  app/
    App.tsx                        # composicion de pantallas
    gateway/                       # unico cliente Socket.IO y comandos tipados
    state/                         # sesion, reducer, resync y correlacion de snapshots
    styles/                        # estilos globales mientras la cascada sea compartida
  features/
    room-access/                   # identidad, create/join y reconexion visible
    lobby/                         # sala previa, host, start y salida
    game/                          # mesa, mano, pila, ready, pausa, estrella y logs
      components/
      model/
    results/                       # victoria/derrota, ranking y retry
  shared/                          # solo reutilizacion demostrada entre features
    ui/
    assets/
```

- `app/gateway/` es el unico lugar que importa `socket.io-client` o conoce nombres de eventos wire. Expone comandos semanticos y eventos tipados; no importa React ni mantiene estado visual.
- `app/state/` coordina gateway, identidad persistida, conexion, versiones, estado publico/privado y resync. Expone a `App.tsx` estado y comandos explicitos; no renderiza UI.
- `features/` recibe datos y callbacks por props desde `App.tsx`; ninguna feature importa `app/state`, gateway ni internals de otra feature.
- `game/` mantiene como internals los subflujos que comparten mesa y animaciones. Estrella, mano/pila, ready/pausa y logs solo se elevan a features hermanas si adquieren lifecycle y API realmente independientes.
- `shared/` no importa `app/` ni `features/`. Un modulo entra en `shared/` solo despues de tener al menos dos consumidores reales; no se crean `utils/`, `components/` o `hooks/` globales como cajones de sastre.
- Cada feature y cada limite de `app/` expone una API pequena mediante su `index.ts`; consumidores externos no importan rutas internas. No se crea un barrel global de todo `src/`.
- Tests, modelos, componentes y estilos especificos se co-localizan con su propietario. Antes del primer movimiento se cambia `npm test` y `test:coverage` para descubrir `src/**/*.test.ts(x)` de forma recursiva y se prueba que ningun test queda omitido.
- `styles.css` conserva inicialmente su ubicacion/cascada para no mezclar estructura y regresion visual. Se mueve a `app/styles/` o se reparte por feature solo despues de caracterizar orden, breakpoints y selectores compartidos; no se introduce un design system ni CSS Modules por defecto.
- Direccion permitida: `main -> app`; `app -> features + shared`; `app/state -> app/gateway + shared`; `features -> shared`; `shared` no depende de capas superiores.

## Reglas comunes de migracion

- No se fuerza simetria entre aplicaciones: backend usa capas; frontend usa shell de aplicacion y features.
- Los nombres describen propietario o capacidad, no el mecanismo generico usado para implementarla.
- No hay reexports temporales prolongados ni dos rutas activas; cada slice mueve codigo, tests e imports y elimina el origen.
- Los alias de paths solo se introducen si reducen imports cruzados tras existir limites estables; no sustituyen enforcement de dependencias.
- Los checks locales verifican imports prohibidos, APIs publicas, ciclos y descubrimiento real de tests de acuerdo con la fase ya migrada.

# Convenciones

- TypeScript estricto en ambos paquetes. Fuente: `apps/backend/tsconfig.json`, `apps/frontend/tsconfig.json`.
- Backend en `NodeNext` con imports ESM terminados en `.js` desde archivos TS compilados. Fuente: `apps/backend/tsconfig.json`, imports de `apps/backend/src/index.ts`.
- Frontend con `moduleResolution: Bundler`, `jsx: react-jsx` y `noEmit: true`. Fuente: `apps/frontend/tsconfig.json`.
- Aplicaciones principales de archivo unico con helpers extraidos, sin router ni libreria externa de estado global. Fuente: `apps/frontend/src/App.tsx`, `apps/frontend/package.json`, arbol `apps/frontend/src/`.
- Estado publico y privado separados explicitamente: el backend emite `room:update`, `player:state` y `room:snapshot`; el frontend recompone los fragmentos con `roomSync.ts`. Fuente: `apps/backend/src/index.ts`, `apps/frontend/src/roomSync.ts`.
- Las fronteras Socket.IO importan `ClientToServerEvents`/`ServerToClientEvents` desde `@the-hive/contracts`; el backend valida payloads externos con parsers antes de aplicar reglas. Eventos reservados de Socket.IO no pertenecen a esos mapas.
- Tests junto al codigo que validan helpers puros y reglas aisladas. Fuente: `apps/backend/src/*.test.ts`, `apps/frontend/src/*.test.ts`.
- No aplica: no se observaron scripts de linting ni formateo declarados en los manifests inspeccionados. Fuente: `apps/backend/package.json`, `apps/frontend/package.json`.
- `DomainResult` es discriminado: el rechazo solo contiene error y no se aplica; el éxito entrega estado completo, eventos y efectos declarativos. El adaptador fusiona exclusivamente estado funcional y conserva metadata de transporte.
- El dominio no importa contracts wire, Fastify, Socket.IO, `@fastify/*`, `node:*`, shell, frontend ni infraestructura, ni usa imports dinámicos, `process`, `Date.now`, `Math.random` o timers. `npm run check:layers` lo verifica por AST en `src/domain/**` y también rechaza aristas prohibidas desde `application/`.
- `test`, `test:coverage` y `build` ejecutan antes `check:domain`; la cobertura usa el reporter de Node para exigir >=80% de líneas, branches y funciones sobre los archivos medibles del límite lógico, excluyendo tests y módulos declarativos.
- Los efectos de setup/ronda/cartas/progresion/estrella declaran `trigger`, `dueAt` y expectativas de fase, razon y deadline. `ProcessScheduler` reemplaza trabajo por `{ roomCode, trigger }`; `effectUseCases.ts` materializa los efectos, incluido `star-settled`, con sala y versión esperadas. Al vencer, el dominio rechaza fase, lock o deadline que ya no coinciden; una versión distinta, retry o sala eliminada tampoco guarda ni publica. Los handlers solo validan wire, resuelven sesión, invocan casos de uso y traducen el ack.
- `domain/cards.ts` es el único propietario de mínimo propio, bloqueantes, penalización de vida, `errorCounts`, descartes de error, outcomes de carta y la elección del siguiente CPU. `GameUseCases.playCard` y `EffectUseCases` solo adaptan/persisten los hechos de dominio; este último programa y reinyecta `error-expired`, `round-flip-expired`, `round-unflip-expired` y `cpu-turn` sin recalcular una regla.
- `domain/star.ts` es el único propietario de propuesta, votos, consenso, consumo, preview, settlement y outcome de estrella. `StarUseCases` conserva solo la espera visual por identidad estable y `EffectUseCases` vuelve al settlement con el efecto decidido; transporte e infraestructura no calculan participantes de negocio ni mutan manos, estrellas, fase o locks.
- `domain/progression.ts` es el único propietario de recompensa, topes, avance de nivel, bloqueo de readiness, derrota y victoria; `domain/scoring.ts` es el único propietario de puntuación, bandas, mensajes, penalizaciones y orden final. `EffectUseCases` devuelve `next-level-expired` y `level-ready-expired` al dominio y publica sus eventos ya decididos; `index.ts` solo compone sus dependencias.
- Un `event-message-overlay` visible bloquea todos los controles de gameplay del frontend, incluida la carta principal, aunque la capacidad privada siga habilitada; los handlers repiten la guarda para evitar emisiones por carrera. Controles auxiliares como log o salida no forman parte de este bloqueo.

# Reglas de legibilidad

- Extraer reglas densas al dominio cuando no requieren acceso directo al socket o al estado global; `gameTiming.ts` conserva solo utilidades de lock y `roomSync.ts` es una proyección de UI.
- Mantener el contrato publico/privado del estado de sala: `RoomPresenter` debe preservar que la mano completa no salga por broadcast masivo; el publisher la envía solo al socket asociado por `SessionRegistry`.
- Mantener envelopes versionados y marcas de tiempo para resync del cliente. Fuente: `roomPresenter.ts` y `registerRoomHandlers.ts`.
- Mantener logs y feedback acotados: `SocketEventPublisher` conserva los últimos 50 logs y el cliente replica ese recorte.
- Incertidumbre: `apps/backend/src/index.ts` y `apps/frontend/src/App.tsx` siguen siendo archivos grandes con muchas responsabilidades; la legibilidad actual depende mas de helpers y nombres que de una separacion por features.

# Patrones usados

- Estado autoritativo en backend con repositorio en memoria y scheduler por sala. Fuente: `apps/backend/src/infrastructure/`.
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
- Docker Compose y Render construyen `packages/contracts` desde la raíz antes de cada aplicación; ambas apps lo declaran mediante `file:../../packages/contracts`, sin workspace raíz ni registry externo.
- Evitar documentar dependencias transitivas como contrato del proyecto; esta regeneracion lista solo dependencias directas declaradas en los manifests de cada app.

# Maquina de estados autoritativa

- `apps/backend/src/domain/stateMachine.ts` es la fuente única pura para aceptar o rechazar triggers de partida. Importa vocabulario funcional desde `domain/model.ts` y recibe un snapshot mínimo, actor y reloj inyectado.
- La API `evaluateGameTransition()` devuelve una decisión discriminada, patch de fase/lock y effects temporales declarativos; no usa Socket.IO, Maps, timers reales ni estado visual. `setup.ts` y `round.ts` la invocan antes de sus decisiones; los handlers de `index.ts` adaptan el estado en memoria, traducen resultados y programan infraestructura.
- Los triggers incluyen entrada, ready/countdown, juego/pausa/error, consenso de estrella, cierre de ronda/nivel, terminales, retry y expiraciones. Un callback temporal debe conservar fase, motivo de lock y deadline esperados para ignorarse tras retry, reemplazo de lock o eliminación de sala.
- `domain/participants.ts` publica políticas nombradas: ready, play, pause, consensus y settlement. No debe introducirse un predicado genérico que cambie sus poblaciones.
- `buildPrivateActions()` proyecta capacidades privadas autorizadas, incluidas cancelación y rechazo de estrella. Frontend usa `enabled` para emitir comandos; fase, lock, `Date.now()` y overlays permanecen exclusivamente como presentación.

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

- `npm test` en `apps/backend`: ejecuta `check:domain` y los tests raíz y de `src/domain/`. Fuente: `apps/backend/package.json`.
- `npm run test:coverage` en `apps/backend`: ejecuta `check:domain`, cobertura experimental del test runner de Node y el gate del límite lógico. Fuente: `apps/backend/package.json`.
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
