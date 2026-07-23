---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: design
created_at: 2026-07-21T22:02:11Z
created_by_command: /sdd:design
source_prompt: |-
  Quiero introducir una capa de aplicacion que orqueste el dominio sin depender de Socket.IO.

  Alcance:
  - Crear casos de uso para sala, reconexion, inicio, ready, jugar, pausa, estrella, retry y desconexion.
  - Definir dependencias para repositorio, eventos, reloj, random y scheduler.
  - Devolver resultados tipados con cambios, errores y eventos.
  - Crear `application/` por familias cohesivas, con puertos bajo `application/ports/` solo para dependencias externas reales.
  - Normalizar la ubicacion fisica de la maquina canonica dentro de `domain/` al poder actualizar todos sus consumidores y checks en un unico slice.
  - Migrar por familias manteniendo contratos externos.
  - Anadir tests con fakes deterministas.

  Actualizacion del contexto del proyecto:
  - Relacionar en `domain.md` requirements y permisos con los casos de uso responsables.
  - Definir en `architecture.md` application layer, puertos y direccion de dependencias.
  - Actualizar `AGENTS.md` con una referencia al mapa de casos de uso.
  - Automatizar localmente las reglas de imports descritas en `architecture.md`.

  Restricciones:
  - Los casos de uso no reciben sockets.
  - `application/` no importa Fastify, Socket.IO ni implementaciones de `infrastructure/`.
  - No crear una interfaz por funcion sin limite real.
  - No crear carpetas genericas `services`, `helpers`, `managers` o `utils`.
  - No cambiar contratos publicos.
  - No copiar estas reglas a agentes SDD genericos.

  Validacion:
  - Los handlers migrados delegan en casos de uso.
  - Los casos de uso se prueban sin red.
  - Autorizacion y errores coinciden con `domain.md`.
  - Los tests de subdirectorios se descubren realmente y los checks prueban `application -> domain` sin aristas inversas.
status: approved
spec: .harness/specs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md
approved_at: 2026-07-21T22:06:22Z
approved_by: user
---

# Diseno propuesto

Se introducira una capa `apps/backend/src/application/` que recibe comandos normalizados con `roomCode`, `playerId` y datos propios de la accion, carga y persiste el agregado de sala, invoca las decisiones puras de `domain/` y entrega un resultado discriminado. El socket, el ack y los tipos de `@the-hive/contracts` permaneceran en `transport/socket/`; las implementaciones en memoria, reloj real, random del proceso y timers quedaran en `infrastructure/`. `apps/backend/src/index.ts` sera el composition root que conecta puertos, casos de uso y transporte.

La estructura objetivo de este cambio sera:

```text
apps/backend/src/
  domain/
    stateMachine.ts
    room.ts
    model.ts
    result.ts
    setup.ts
    round.ts
    cards.ts
    star.ts
    progression.ts
    scoring.ts
  application/
    model.ts
    result.ts
    domainAdapter.ts
    playerView.ts
    roomUseCases.ts
    gameUseCases.ts
    starUseCases.ts
    effectUseCases.ts
    ports/
      roomRepository.ts
      eventPublisher.ts
      clock.ts
      randomSource.ts
      scheduler.ts
  infrastructure/
    memory/inMemoryRoomRepository.ts
    runtime/systemClock.ts
    runtime/systemRandomSource.ts
    scheduling/processScheduler.ts
  transport/socket/
    registerSocketHandlers.ts
    sessionRegistry.ts
    roomPresenter.ts
    socketEventPublisher.ts
  tooling/
    layerBoundaries.ts
    testFiles.ts
    logicCoverageReporter.mjs
```

`ApplicationRoom` en `application/model.ts` conservara el estado funcional de `DomainMatch` y la metadata no wire necesaria para operar la sala: codigo interno y visible, visibilidad, version y log semantico. No contendra sockets ni instancias de Fastify/Socket.IO. La asociacion efimera `socket.id -> playerId -> roomCode` sera responsabilidad exclusiva de `transport/socket/sessionRegistry.ts`; el transporte solo invocara reconexion o desconexion si la sesion sigue siendo la vinculacion activa, evitando que el `disconnect` de un socket reemplazado desconecte la sesion nueva.

`ApplicationResult<T>` en `application/result.ts` tendra dos variantes:

```ts
type ApplicationResult<T> =
  | { ok: false; error: { code: ApplicationErrorCode; message: string } }
  | {
      ok: true;
      data: T;
      changes: ApplicationChange[];
      events: ApplicationEvent[];
      effects: ApplicationEffect[];
    };
```

La variante rechazada no incluira estado, cambios, eventos ni efectos. `message` preservara literalmente el error observable actual; `code` sera interno y estable para impedir que el adaptador Socket.IO tenga que inferir la causa desde el texto. Los cambios identificaran altas, guardados versionados, bajas y cambios de presencia; los eventos semanticos llevaran todos los datos necesarios para snapshots, logs y emisiones; los efectos llevaran clave de reemplazo, `roomCode`, `dueAt` y las expectativas de fase/lock/deadline ya declaradas por el dominio. El publicador Socket.IO traducira estos tipos a los acks y eventos actuales sin recalcular autorizacion, participantes, penalizaciones, outcomes ni privacidad.

Mapa de propiedad de casos de uso:

| Familia SPEC | API de aplicacion | Dominio/decision invocada | Callback incluido |
| --- | --- | --- | --- |
| Sala | `createRoom`, `joinRoom`, `leaveRoom`, `kickPlayer`, `resyncRoom` en `roomUseCases.ts` | admision, aforo, host y baja en `domain/room.ts` | eliminacion de sala y cancelacion de trabajos |
| Reconexion | rama explicita `reconnectPlayer` en `roomUseCases.ts` | identidad existente y preservacion de mano/estado | reemplazo de vinculacion en `sessionRegistry` despues del exito |
| Desconexion | `disconnectPlayer` en `roomUseCases.ts` | presencia, ready, host y conservacion de mano | cierre de espera visual de estrella y emision posterior |
| Inicio y retry | `startGame`, `retryGame` en `gameUseCases.ts` | `domain/setup.ts` | expiracion de dealing en `effectUseCases.ts` |
| Ready y pausa | `setPlayerReady`, `requestPause` en `gameUseCases.ts` | `domain/round.ts` | expiracion de countdown en `effectUseCases.ts` |
| Jugar | `playCard` en `gameUseCases.ts` | `domain/cards.ts` y `domain/progression.ts` | error, flip/unflip, avance, liberacion de nivel y turno CPU en `effectUseCases.ts` |
| Estrella | `proposeStar`, `acceptStar`, `cancelStar`, `rejectStar`, `completeStarAnimation` en `starUseCases.ts` | `domain/star.ts` | ack, desconexion y deadline convergen en un unico settlement en `effectUseCases.ts` |

Los puertos seran limites agrupados, no interfaces por operacion:

- `RoomRepository`: consulta por codigo o identidad, existencia de codigo, guardado con version esperada, append acotado de log y borrado. El adaptador en memoria mantendra los indices hoy representados por `rooms` y `playerRoom`; un guardado funcional incrementara la version una sola vez y un log no la incrementara, igual que la linea base.
- `ApplicationEventPublisher`: publica en orden un `ApplicationEvent` ya completo. `socketEventPublisher.ts` sera su implementacion de transporte y usara presenters publico/privado para conservar destinos, orden y privacidad.
- `Clock`: expone `now()`; toda marca temporal, deadline, `serverTime`, `syncedAt` e id de log se obtiene de este puerto dentro de aplicacion.
- `RandomSource`: expone `next()`; la generacion de codigos y el Fisher-Yates del mazo se mantienen en funciones de aplicacion que consumen esa unica fuente.
- `Scheduler`: reemplaza, cancela y programa trabajo por `{ roomCode, key }`. Sus callbacks llaman a `effectUseCases.ts` con el efecto original; el dominio vuelve a validar fase, lock y deadline antes de cualquier guardado. El fake no usa timers y permite avanzar o ejecutar trabajos por clave.

Cada caso de uso aceptado guardara primero el nuevo estado mediante `RoomRepository`, construira el resultado ordenado y lo despachara por `ApplicationEventPublisher` y `Scheduler` antes de responder al adaptador. El mismo resultado se devuelve para assertions y para construir el ack, pero el handler no volvera a publicar o programar sus arrays. Las emisiones se modelaran en el orden observable actual; por ejemplo, inicio mantiene snapshot versionado, `game:started`, log y ack, mientras pausa manual mantiene snapshot, `game:paused`, log y ack. Los caminos automaticos de error y estrella no fabricaran `game:paused`.

Los presenters recibiran `ApplicationRoom` y la identidad propietaria. `roomPresenter.ts` sera el unico modulo backend que importe simultaneamente el modelo de aplicacion y `@the-hive/contracts`; producira `PublicRoomEnvelope`, `PrivatePlayerEnvelope` y `RoomSnapshot`, manteniendo mano y acciones en la proyeccion privada. `playerView.ts` calculara capacidades desde la maquina y poblaciones de dominio con reloj inyectado, sin importar contracts wire.

La migracion se realizara en estados estables y con propietario unico: primero se incorporan descubrimiento recursivo, checks y puertos/adaptadores; despues se mueve atomica y unicamente `gameStateMachine.ts` a `domain/stateMachine.ts` junto con todos sus imports, tests y alcance del checker. A continuacion se migran sala/reconexion/presencia, inicio/retry, ready/pausa, juego/progresion/CPU y estrella/settlement. En cada slice se redirigen todos los handlers y callbacks de esa familia, se eliminan sus Maps/timers/helpers previos de `index.ts` y se ejecuta la suite Socket.IO antes de continuar. No habra reexport desde la ruta antigua ni feature flag con doble escritura.

## D-01

- **Pregunta:** ¿Donde reside la identidad de conexion sin introducir sockets en aplicacion?
- **Decision:** La aplicacion opera con `playerId` y `roomCode`; `sessionRegistry.ts` conserva la asociacion con `socket.id` y solo notifica cambios de presencia para la sesion activa.
- **Motivo:** La identidad estable es funcional, pero la conexion concreta es una responsabilidad del adaptador realtime.
- **Impacto:** Reconectar preserva mano y estado; un socket sustituido puede cerrarse sin provocar una desconexion stale.

## D-02

- **Pregunta:** ¿Como se representa una ejecucion aceptada o rechazada?
- **Decision:** Usar `ApplicationResult<T>` discriminado, sin cambios en rechazo y con `data`, `changes`, `events` y `effects` en exito.
- **Motivo:** Hace comprobable CA-03 y evita que el handler complete decisiones omitidas.
- **Impacto:** Los tests pueden comparar de forma exhaustiva mutacion, publicaciones y scheduling para cada comando.

## D-03

- **Pregunta:** ¿Quien materializa eventos y efectos si el resultado tambien los devuelve?
- **Decision:** Un dispatcher de aplicacion usa los puertos `ApplicationEventPublisher` y `Scheduler` una sola vez despues del commit y devuelve el mismo inventario al llamador; el handler solo traduce el ack.
- **Motivo:** Satisface los limites externos solicitados sin acoplar los casos de uso a Socket.IO ni duplicar emisiones.
- **Impacto:** Los fakes capturan orden y efectos, y `socketEventPublisher.ts` conserva los contratos existentes.

## D-04

- **Pregunta:** ¿Como se evita que un timer previo cambie una sala nueva o reintentada?
- **Decision:** Cada trabajo se identifica por sala y clave, transporta el `DomainEffect` original y vuelve por `effectUseCases.ts`; el dominio valida `phase`, `lockReason`, `lockUntil` y `dueAt` antes de guardar.
- **Motivo:** Es la extension directa de las guardas stale ya presentes en `expireRoundEffect`, `expireCardEffect`, `expireProgressionEffect` y `settleStar`.
- **Impacto:** Retry, borrado de sala y reemplazo de lock cancelan trabajos por clave y los callbacks tardios son no-op rechazados.

## D-05

- **Pregunta:** ¿Como se mantiene versionado, log y orden de emisiones?
- **Decision:** `RoomRepository` incrementa version solo en guardados funcionales, conserva logs aparte de la revision y el resultado enumera eventos en el orden baseline; el publisher los ejecuta secuencialmente.
- **Motivo:** `emitRoomUpdate()` incrementa hoy la version, mientras `emitGameLog()` agrega hasta 50 entradas sin incrementarla.
- **Impacto:** Resync, snapshots, eventos decorativos y logs mantienen correlacion y orden observables.

## D-06

- **Pregunta:** ¿Donde se ubican la maquina canonica y las reglas de lobby consumidas por aplicacion?
- **Decision:** Mover sin reexport `gameStateMachine.ts` a `domain/stateMachine.ts` y `lobbyRules.ts` a `domain/room.ts`, actualizando todos los consumidores en el mismo slice.
- **Motivo:** `application/` solo puede depender de `domain/`; mantener estas decisiones fuera obligaria una arista lateral o duplicacion.
- **Impacto:** El checker puede imponer `application -> domain` y `domain` queda como propietario unico de autorizacion y admision.

## D-07

- **Pregunta:** ¿Como se prueba la espera visual de estrella sin sockets ni timers reales?
- **Decision:** Guardar en estado de aplicacion el efecto de settlement y los ids humanos conectados pendientes; ack, desconexion o deadline actualizan esa espera y convergen en `settleStar` una sola vez.
- **Motivo:** `starAnimation.ts` ya coordina ids y un efecto decidido sin modificar reglas de manos, recursos o fase.
- **Impacto:** Un fake de scheduler y comandos por identidad cubren settlement, duplicados, desconexion y timeout de forma determinista.

## D-08

- **Pregunta:** ¿Como se garantiza descubrimiento recursivo en el runtime actual?
- **Decision:** `tooling/testFiles.ts` enumerara recursivamente `src/**/*.test.ts`, ordenara la lista y lanzara `node --import tsx --test` con paths explicitos; `test` y `test:coverage` usaran el mismo inventario.
- **Motivo:** `apps/backend/Dockerfile` fija Node 20 y los scripts actuales enumeran solo raiz y `src/domain/`; no se dependera de discovery TypeScript o globbing de una version distinta del runtime.
- **Impacto:** Los tests bajo `application/`, `infrastructure/`, `transport/` y `tooling/` se ejecutaran realmente en ambos comandos.

## D-09

- **Pregunta:** ¿Como se automatiza la direccion de dependencias?
- **Decision:** Sustituir el alcance de `domainBoundaries.ts` por `tooling/layerBoundaries.ts`, resolviendo imports estaticos y dinamicos del arbol real para imponer `domain -> domain`, `application -> application|domain`, y prohibir en aplicacion Fastify, Socket.IO, contracts wire, `node:*`, transport e infrastructure.
- **Motivo:** El checker actual solo inspecciona `domain/` y la ruta plana de la maquina; CA-08 exige comprobar tambien aplicacion y la arista inversa.
- **Impacto:** `check:layers` sera ejecutado por test, cobertura y build; `check:domain` quedara como alias compatible durante este cambio documental y de scripts.

# Evidencia y estado actual

- La SPEC aprobada fija nueve familias, resultados tipados, cinco limites externos, migracion por propietario unico, maquina bajo `domain/`, contratos invariantes y cobertura determinista: `.harness/specs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md` (CA-01 a CA-12).
- `apps/backend/src/index.ts:55-119` declara `Player`, `GameState`, `Room`, `rooms`, `playerRoom`, `socketPlayer`, cinco Maps de timers, `random` y `timingScale`; hoy estado, runtime y transporte comparten el mismo modulo.
- `apps/backend/src/index.ts:172-308` contiene `serializeRoom`, `buildPrivateState`, envelopes, versionado, emisiones privadas/publicas y log acotado, por lo que esa secuencia es la linea base del publisher y presenters.
- `apps/backend/src/index.ts:368-729` materializa expiraciones de ronda, progresion, cartas, CPU y estrella; los callbacks ya devuelven el efecto original al dominio, pero consultan Maps, reloj y timers globales.
- `apps/backend/src/index.ts:751-913` concentra baja, host, desconexion, binding, salas CPU y limpieza; `markSocketDisconnected()` conserva la mano, limpia ready y avanza la espera visual de estrella.
- `apps/backend/src/index.ts:915-1381` registra los quince handlers de cliente y `disconnect`; todos contienen actualmente acceso directo a Socket.IO y parte de la orquestacion que pasara a los casos de uso.
- `apps/backend/src/domain/result.ts:3-39` ya define `DomainResult`, `DomainEvent` y `DomainEffect` discriminados; la aplicacion los envolvera sin cambiar las decisiones del dominio.
- `apps/backend/src/domainAdapter.ts:49-93` demuestra la conversion `Room -> DomainMatch` y el merge que preserva metadata, pero prohibe altas/bajas de jugadores; se movera a aplicacion y se complementara con operaciones de sala.
- `apps/backend/src/gameStateMachine.ts:39-238` es la autoridad de triggers y errores. Sus consumidores reales son `domain/setup.ts`, `round.ts`, `cards.ts`, `star.ts`, `progression.ts`, `privateState.ts`, `index.ts` y `gameStateMachine.test.ts`, segun la busqueda de imports.
- `apps/backend/src/domain/setup.ts`, `round.ts`, `cards.ts`, `star.ts` y `progression.ts` reciben reloj, mazo, duraciones y efectos como datos; no requieren red y son directamente orquestables por la nueva capa.
- `apps/backend/src/lobbyRules.ts:24-67` posee admision y kick, mientras `apps/backend/src/starAnimation.ts:12-37` posee espera visual por ids; ambas piezas son puras y tienen tests co-localizados.
- `packages/contracts/src/events/maps.ts:9-40` es el mapa wire vigente de comandos, acks y emisiones. No se modificara; se usara como contrato de compilacion del adaptador Socket.IO.
- `apps/backend/src/socketIntegration.test.ts:121-368` caracteriza privacidad, resync/rejoin, errores wire, pausa manual frente a automatica, estrella, retry y victoria; es el gate de regresion por familia.
- `apps/backend/src/domainBoundaries.ts:49-59` descubre recursivamente solo fuentes del dominio y añade manualmente `gameStateMachine.ts`; no inspecciona `application/` ni resuelve todas las aristas de capas.
- `apps/backend/package.json:9-11` ejecuta tests solo con `src/*.test.ts src/domain/*.test.ts`; `apps/backend/Dockerfile:1` usa Node 20, de modo que la solucion no asumira discovery TypeScript de Node 22.
- `apps/backend/src/domainCoverageReporter.mjs:1-31` ya exige 80% agregado de lineas, branches y funciones para dominio/maquina, pero todavia no mide aplicacion.
- La documentacion de Node v22 consultada confirma discovery automatico y multiples reporters, pero la diferencia con el runtime Node 20 fijado por el proyecto justifica enumerar paths TypeScript explicitamente en tooling propio.
- No existe otro DESIGN que enlace esta SPEC; este es el unico artefacto propuesto para `d70c49e2`.

# Cambios e impacto

- **Dominio:** reubicacion atomica de la maquina en `domain/stateMachine.ts`; traslado de reglas puras de sala a `domain/room.ts`; las operaciones actuales de setup, ronda, cartas, estrella, progresion y scoring mantienen firmas y autoridad salvo imports actualizados.
- **Aplicacion:** nueva API por familias, agregado sin sockets, resultados discriminados, adaptacion al dominio, vista privada y puertos de repositorio/eventos/reloj/random/scheduler.
- **Infraestructura:** los Maps de salas/indices y timers salen de `index.ts` hacia implementaciones concretas; reloj y random de produccion se inyectan desde el composition root.
- **Transporte:** parsers, `socket.id`, rooms de Socket.IO, acks, presenters y publicacion wire quedan bajo `transport/socket/`; todos los handlers migrados se limitan a validar, resolver identidad, invocar y mapear el resultado.
- **Composition root:** `index.ts` conserva Fastify, CORS, health, construccion de dependencias, lifecycle y exports `startServer`, `stopServer`, `resetServerForTests`; deja de contener reglas, serializacion y scheduling operativo.
- **Contratos:** `packages/contracts/` y el frontend no cambian. Se preservan nombres de eventos, payloads, textos, versiones, server time, privacidad, logs y orden funcional.
- **Tooling:** nuevo checker de capas, runner recursivo comun y coverage reporter para `domain/` + `application/`; los comandos canonicos de Docker continúan siendo la entrada de validacion.
- **Migracion:** cada familia elimina su camino anterior y sus timers/helpers del shell en el mismo slice. La busqueda de handlers, imports y simbolos antiguos forma parte del cierre de cada slice.
- **Operacion/despliegue:** no se añade base de datos ni servicio. El repositorio y scheduler siguen siendo de proceso, por lo que Docker Compose y Render conservan su topologia.

# Riesgos tecnicos

- **Orden o version divergente:** mover `emitRoomUpdate()` y `emitGameLog()` puede alterar revision o secuencia. Mitigacion: eventos ordenados en `ApplicationResult`, tests de version antes/despues y regresiones Socket.IO por familia.
- **Exposicion de mano:** un presenter comun podria mezclar estado publico y privado. Mitigacion: tipos separados, snapshot por propietario y assertions negativas para `hand` y `socketId` en broadcasts.
- **Doble materializacion:** devolver arrays y ademas usar puertos puede duplicar emisiones/timers. Mitigacion: dispatcher unico de aplicacion; handlers no recorren `events` ni `effects`; fakes verifican exactamente una llamada.
- **Carrera de reconexion:** el cierre del socket anterior podria desconectar al jugador nuevo. Mitigacion: `sessionRegistry` compara vinculacion activa antes de invocar `disconnectPlayer` y se prueba el orden reemplazo/desconexion.
- **Callbacks stale:** timers de una fase previa, retry o sala borrada pueden escribir tarde. Mitigacion: claves cancelables, version esperada del repositorio y validacion de expectativas en dominio.
- **Settlement de estrella incompleto o duplicado:** ack, timeout y desconexion compiten. Mitigacion: estado de espera persistido por sala, consumo idempotente y un unico efecto `star-settled` validado por lock/deadline.
- **Doble propietario durante migracion:** un handler nuevo y helper viejo podrian escribir la misma familia. Mitigacion: slices completos, borrado en el mismo cambio, busqueda de simbolos y ausencia de feature flags/reexports.
- **Coverage falsa por tests omitidos:** los globs actuales no incluyen subdirectorios nuevos. Mitigacion: enumerador recursivo probado, inventario no vacio y uso comun desde test/cobertura.
- **Checker insuficiente o con falsos positivos:** comparar strings de imports no basta. Mitigacion: resolucion de rutas, fixtures negativos por categoria y prueba sobre el arbol real.
- **Complejidad accidental de puertos:** demasiadas interfaces diluirian ownership. Mitigacion: solo los cinco limites exigidos; session registry y presenters permanecen detalles del transporte, no puertos de aplicacion.

# Estrategia de testing

- Mantener los tests puros actuales de `domain/` y actualizar en un unico slice los imports de `gameStateMachine.test.ts` a `domain/stateMachine.ts`; una busqueda debe confirmar que la ruta antigua no existe ni se importa.
- Añadir tests co-localizados para `roomUseCases`, `gameUseCases`, `starUseCases`, `effectUseCases`, `domainAdapter` y `playerView`, sin arrancar Fastify, Socket.IO ni abrir puertos.
- Proveer fakes compartidos de prueba, con nombre por limite y sin carpeta generica: repositorio clonado/versionado, publicador que captura orden, reloj manual, secuencia random y scheduler manual por clave.
- Para cada familia cubrir exito, cada rechazo/error observable, inmutabilidad en rechazo, `changes`, orden y payload de `events`, `effects`, guardado/versionado y ausencia de segunda publicacion.
- Cubrir tablas de permisos: host/invitado; lobby/partida/fases terminales; conectados con cartas para ready/play/pause; conectados incluso sin cartas para consenso; manos no vacias incluso desconectadas para settlement.
- Cubrir create/join/reconnect/leave/kick/resync/disconnect, aforo, host, cambio de sala, sala privada CPU, conservacion de mano, limpieza completa y socket reemplazado stale mediante el adaptador de sesion sin sockets reales.
- Cubrir todos los callbacks con scheduler manual antes, en y despues de `dueAt`; retry, lock reemplazado, version distinta y sala borrada deben producir rechazo/no-op sin publicacion ni guardado.
- Cubrir estrella con propuesta, voto repetido, cancelacion, rechazo, consenso, consumo unico, ack parcial/total, desconexion y timeout; verificar que la mano cambia solo en settlement.
- Mantener y ampliar `socketIntegration.test.ts` como caracterizacion de contratos. Tras cada slice ejecutar los escenarios de su familia y al cierre toda la suite, comparando acks, textos, eventos, logs, version, snapshots, privacidad y orden.
- `tooling/testFiles.test.ts` comprobara con un arbol temporal anidado que el enumerador incluye raiz y multiples profundidades, excluye produccion y ordena establemente; los scripts fallaran si el inventario esta vacio.
- `tooling/layerBoundaries.test.ts` tendra casos negativos para Fastify, Socket.IO, contracts wire, `node:*`, infrastructure/transport desde aplicacion, application desde dominio, import dinamico y ruta fuera de capa; tambien validara el arbol real.
- Extender el reporter para medir todos los `.ts` ejecutables bajo `domain/` y `application/`, excluyendo tests y archivos solo declarativos. El gate sera `>= 80%` en lineas, branches y funciones agregadas, y fallara si cualquiera de los dos limites no aporta archivos medibles.
- Validacion canonica final: `docker compose run --build --rm --no-deps backend npm test`, `backend npm run test:coverage`, `backend npm run build`, y las tres validaciones frontend para demostrar ausencia de regresion de consumidor.

# Estrategia de documentacion

- Actualizar `.harness/context/domain.md` con una matriz requirement/permiso/poblacion/caso de uso/operacion de dominio, usando los nombres del mapa de este DESIGN y preservando las incertidumbres no resueltas por la SPEC.
- Actualizar `.harness/context/architecture.md` con la estructura realmente creada, los cinco puertos, `ApplicationResult`, direccion de imports, session registry de transporte, dispatcher y reglas de migracion por familia.
- Actualizar `AGENTS.md` con una referencia breve al mapa de casos de uso en `domain.md` y a `application/`; no duplicar reglas ni tocar agentes SDD genericos.
- Actualizar `README.md` solo en comandos de validacion y descripcion de la separacion backend si las rutas o nombres de checks cambian; no alterar alcance funcional ni roadmap.
- Documentar junto a `tooling/layerBoundaries.ts` las categorias ejecutables del checker y junto a los puertos sus invariantes que no se expresen completamente en tipos, especialmente versionado, orden y reemplazo de trabajos.
- No aplica documentacion de contrato publico: `packages/contracts/` no cambia.

# Gaps resueltos

- Se resolvio la separacion entre identidad estable y socket concreto mediante un registro de sesion exclusivo del transporte.
- Se resolvio la aparente duplicidad entre resultados devueltos y puertos de eventos/scheduler con un dispatcher unico de aplicacion y handlers que no rematerializan arrays.
- Se resolvio el ownership de version, log y estado funcional mediante un repositorio de `ApplicationRoom` sin sockets y eventos ordenados.
- Se resolvio el alcance de callbacks: todos vuelven por `effectUseCases.ts` con el efecto original y validacion stale del dominio.
- Se resolvio el descubrimiento recursivo sin asumir comportamiento de Node 22, porque el runtime versionado de desarrollo es Node 20.
- No quedan decisiones tecnicas materiales abiertas para proponer el artefacto; no se reabrieron requisitos funcionales.

# Decision humana

Aprobar. La persona usuaria aprobo el DESIGN sin solicitar cambios.
