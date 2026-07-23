---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: task
created_at: 2026-07-21T22:08:01Z
created_by_command: /sdd:task
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
status: implemented
spec: .harness/specs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md
design: .harness/designs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md
task_number: 01
task_count: 05
---

# Objetivo

Crear un limite de aplicacion comprobable y migrar de extremo a extremo sala, reconexion, resync, baja y desconexion, incluida la reubicacion atomica de la maquina canonica, sin cambiar el wire Socket.IO ni mantener dos propietarios activos.

# Alcance y evidencia

- Aplican `CA-01`, `CA-02`, `CA-03`, `CA-05`, `CA-06`, `CA-07`, `CA-08`, `CA-09`, `CA-10`, `CA-11` y la parte correspondiente de `CA-12` de la SPEC.
- Incorporar `application/model.ts`, `result.ts`, `domainAdapter.ts`, `playerView.ts`, el dispatcher y los cinco puertos agrupados; implementar los adaptadores en memoria/runtime/scheduling y los fakes deterministas requeridos, aunque los slices posteriores activen progresivamente reloj, random y scheduler.
- Migrar `gameStateMachine.ts` a `domain/stateMachine.ts` y `lobbyRules.ts` a `domain/room.ts` sin reexport, actualizando de una vez dominio, `privateState`, tests, checker y todos los imports identificados.
- Migrar `createRoom`, `joinRoom`, `reconnectPlayer`, `leaveRoom`, `kickPlayer`, `resyncRoom` y `disconnectPlayer`; crear `transport/socket/sessionRegistry.ts`, presenters, publisher y registro de handlers, dejando `index.ts` como composition root para esta familia.
- La linea base esta en `apps/backend/src/index.ts:55-308`, `751-1124`, `1365-1430`, `domainAdapter.ts`, `gameStateMachine.ts`, `lobbyRules.ts`, `privateState.ts`, `socketIntegration.test.ts:121-200` y `packages/contracts/src/events/maps.ts`.
- Incluir desde este slice el descubrimiento recursivo, checker de capas y gate de cobertura acordados para que los tests nuevos bajo subdirectorios se ejecuten realmente.

# Criterios de aceptacion

- **CA-02 / CA-07 / CA-08:** `application/` recibe `roomCode`, `playerId` y datos del comando, no sockets; solo depende de `application/` y `domain/`, y sus cinco puertos representan repositorio, publicacion, reloj, random y scheduler sin interfaces por operacion.
- **CA-03:** `ApplicationResult<T>` rechaza con `code/message` y sin estado, cambios, eventos ni efectos; el exito devuelve `data`, `changes`, `events` y `effects`, se guarda primero y se despacha exactamente una vez en orden.
- **CA-05 / CA-06:** create/join/reconnect/leave/kick/resync/disconnect conservan admision, aforo, sala CPU privada, host, logs, version, acks, textos, snapshots y privacidad; desconectar conserva mano y un socket sustituido no puede desconectar la sesion nueva.
- **CA-07:** `RoomRepository` mantiene indices por sala e identidad, guardado con version esperada, version funcional incrementada una vez, log acotado sin incremento y borrado/cancelacion completa de una sala vacia.
- **CA-09 / CA-10:** todos los handlers de esta familia delegan en `roomUseCases.ts`, se retiran sus Maps/helpers/mutaciones anteriores de `index.ts`, y solo existe `domain/stateMachine.ts` como ruta canonica, sin reexport ni doble escritura.
- **CA-11:** `testFiles.ts` enumera de forma recursiva, no vacia y estable todos los `src/**/*.test.ts`; `test` y `test:coverage` usan el mismo inventario y ejecutan tests anidados sin red.
- **CA-08 / CA-11:** `layerBoundaries.ts` resuelve imports estaticos y dinamicos del arbol real, permite `application -> domain`, rechaza la arista inversa y todas las dependencias prohibidas; `check:domain` queda como alias compatible y test, cobertura y build ejecutan el check.

# Tareas de implementacion

- **TI-01 — Habilitar descubrimiento y checks:** implementar y probar `tooling/testFiles.ts` y `tooling/layerBoundaries.ts`, actualizar scripts y sustituir el checker previo sin perder su cobertura del dominio; incluir fixtures negativos para cada categoria del DESIGN.
- **TI-02 — Normalizar dominio atomicamente:** mover maquina y reglas de sala a `domain/`, actualizar todos los consumidores/tests/checks y eliminar las rutas antiguas; confirmar por busqueda que no quedan imports ni reexports transitorios.
- **TI-03 — Definir modelo, resultado y puertos:** crear `ApplicationRoom`, cambios/eventos/efectos completos, codigos de error, dispatcher y los cinco puertos con invariantes de version, orden y reemplazo; mover el adaptador de dominio y la proyeccion de capacidades con reloj inyectado.
- **TI-04 — Implementar adaptadores y fakes:** extraer repositorio/indices, reloj, random y scheduler a `infrastructure/`, implementar el publicador Socket.IO en transporte y proveer fakes clonados/manuales/secuenciales para tests sin red ni timers reales.
- **TI-05 — Migrar la familia de sala:** implementar los siete casos de uso, conectar create/join/leave/kick/resync, la rama explicita de reconexion y disconnect, y retirar en el mismo cambio sus mutaciones, indices y helpers previos del shell.
- **TI-06 — Separar sesion y presentacion:** implementar registro `socket.id -> playerId -> roomCode` con comparacion de vinculacion activa, presenters publico/privado y handlers que solo parsean, resuelven identidad, invocan y traducen ack.
- **TI-07 — Cubrir y auditar:** probar exito, rechazos, inmutabilidad, cambios, version/log, orden, una sola publicacion, privacidad, host, sala vacia, CPU, reconexion y disconnect stale; verificar por busqueda propietario unico y ausencia de imports prohibidos.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Exigir `>= 80%` agregado en lineas, branches y funciones sobre codigo ejecutable nuevo o modificado de `domain/` y `application/`; el reporter debe fallar si alguno de ambos limites no aporta archivos medibles.
- Ejecutar las regresiones Socket.IO de create, join, resync, reconnect, kick, leave y disconnect, comparando acks, errores, logs, versiones, snapshots, orden y ausencia de `hand`/`socketId` en broadcasts.
- Validar `layerBoundaries` sobre fixtures y arbol real, el inventario recursivo de tests y una busqueda que confirme que no existen `src/gameStateMachine.ts`, `src/lobbyRules.ts`, handlers dobles ni imports de las rutas retiradas.

# Documentacion aplicable

- Actualizar `.harness/context/architecture.md` con la estructura realmente creada, `ApplicationResult`, los cinco puertos, dispatcher, direccion de imports, session registry, checker, descubrimiento y coverage.
- Actualizar `.harness/context/domain.md` con la responsabilidad de sala/reconexion/desconexion y sus poblaciones/permisos, preservando las incertidumbres existentes.
- Documentar junto a puertos y tooling las invariantes no expresables completamente por tipos: version/log, orden de publicacion, commit previo, reemplazo/cancelacion de trabajos y vinculacion de sesion activa.
- No actualizar aun `AGENTS.md`; el indice final al mapa completo corresponde a TASK 05.

# Riesgos y restricciones

- Mitigar divergencias de version/orden y doble materializacion con tests de secuencia y conteo exacto del dispatcher; mitigar exposicion de mano con presenters separados y assertions negativas.
- Mitigar la carrera de reconexion comparando la vinculacion activa antes de desconectar; mitigar doble propietario retirando cada camino anterior en este mismo slice.
- Mitigar coverage falsa y checker insuficiente con inventario recursivo probado, resolucion de rutas y fixtures negativos, no con globs supuestos ni comparacion simple de strings.
- No cambiar `packages/contracts/`, frontend, acks, eventos, textos, privacidad ni topologia; no crear carpetas genericas, puertos ceremoniales, feature flags, reexports o doble escritura.
