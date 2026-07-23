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
task_number: 03
task_count: 05
---

# Objetivo

Migrar ready y pausa manual a `gameUseCases.ts` y completar la orquestacion de dealing/countdown en `effectUseCases.ts`, preservando poblaciones, autorizacion, silencios automaticos y contratos Socket.IO.

# Alcance y evidencia

- Aplican `CA-01`, `CA-02`, `CA-03`, `CA-04`, `CA-06`, `CA-07`, `CA-09`, `CA-11` y la trazabilidad de `CA-12`.
- Implementar `setPlayerReady` y `requestPause` sobre `domain/round.ts`; completar callbacks `dealing-expired` y `countdown-expired` con scheduler manual y reloj inyectado.
- Migrar `player:ready` y `game:pause-request`, retirando su acceso directo a dominio, timers, CPU readiness, publicacion y serializacion del shell.
- Preservar las poblaciones distintas: ready, juego y pausa usan conectados con cartas; una mano vacia no bloquea ready; CPU permanece conectada/ready; consenso y settlement no se alteran en este slice.
- La linea base esta en `apps/backend/src/index.ts:368-446`, `547-554`, `1126-1153`, `1271-1290`, `domain/round.ts`, `domain/participants.ts`, `privateState.ts` y `socketIntegration.test.ts:202-255`.
- No incluye juego/progresion/CPU ni estrella; sus propietarios actuales no deben ser duplicados o reinterpretados.

# Criterios de aceptacion

- **CA-02 / CA-03:** ambos comandos y los callbacks se prueban sin sockets/timers reales; rechazo no muta ni despacha y exito devuelve cambios, eventos y efectos completos.
- **CA-04:** ready/unready conserva fase, lock, actor, poblacion y textos canonicos; quorum completo programa countdown una vez y una mano vacia conectada no forma parte del quorum.
- **CA-04:** pausa solo acepta participantes activos, limpia ready de la poblacion correcta, conserva CPU ready y no recalcula permisos fuera del dominio.
- **CA-06:** ready conserva ack y snapshots; pausa manual conserva snapshot, `game:paused`, log y ack en orden, mientras expiraciones o pausas automaticas no fabrican `game:paused` ni su log.
- **CA-07:** `Clock` produce todas las marcas/deadlines y `Scheduler` reemplaza countdown por clave; el callback usa el efecto original y vuelve a validar expectativas antes del commit.
- **CA-09:** los dos handlers y callbacks delegan exclusivamente en aplicacion, y se retiran sus timers/helpers/mutaciones previos de `index.ts` en el mismo slice.
- **CA-11:** tests tabulares cubren host/invitado, focus/paused/playing, manos vacias, CPU, locks y callbacks antes/en/despues de deadline, retry, version distinta y sala borrada.

# Tareas de implementacion

- **TI-01 — Congelar matrices de permisos:** caracterizar ready/unready, quorum, CPU, pausa y errores por fase/lock/poblacion, incluida la diferencia entre pausa solicitada y automatica.
- **TI-02 — Implementar ready y pausa:** añadir ambos casos de uso a `gameUseCases.ts`, adaptar resultados de `domain/round.ts`, guardar con version esperada y construir eventos/efectos sin decisiones suplementarias.
- **TI-03 — Completar expiraciones de ronda:** encauzar dealing/countdown por `effectUseCases.ts`, reemplazar/cancelar claves y probar no-op rechazado para callbacks tardios o expectativas divergentes.
- **TI-04 — Migrar handlers:** dejar en transporte parser, sesion y ack; retirar materializacion, timers, readiness CPU y traduccion de pausa duplicadas del shell.
- **TI-05 — Validar vistas privadas:** comprobar que `playerView.ts` obtiene capacidades de la maquina/poblaciones con reloj inyectado y que las acciones ready/pause coinciden con la autoridad de comando.
- **TI-06 — Auditar propietario unico:** buscar llamadas directas a `setRoundReady`, `pauseRound`, `expireRoundEffect`, Maps de countdown y emisiones de pausa fuera de los modulos permitidos.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests unitarios de `gameUseCases`/`effectUseCases` con reloj y scheduler manual, incluidos rechazos, inmutabilidad, orden, version y ejecucion unica.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Exigir `>= 80%` en lineas, branches y funciones sobre codigo nuevo o modificado y ejecutar regresiones Socket.IO de ready, countdown, pausa manual y pausa automatica silenciosa.
- Validar por checker y busqueda ausencia de timers/reloj global/imports prohibidos en aplicacion, handlers dobles y poblaciones alternativas que cambien la autorizacion.

# Documentacion aplicable

- Actualizar `.harness/context/domain.md` con los casos de uso ready/pausa, fases, permisos y poblacion exacta, sin cambiar consenso o settlement.
- Actualizar `.harness/context/architecture.md` con el flujo comando/commit/dispatch y callback por `effectUseCases.ts` realmente implementado.
- No aplica documentacion de contrato publico; no actualizar aun `AGENTS.md`.

# Riesgos y restricciones

- Mitigar errores de autorizacion manteniendo predicados nombrados para ready/play/pause y tablas separadas; no introducir un quorum generico.
- Mitigar callbacks stale con expectativas completas y version esperada; mitigar orden/doble publicacion con conteos exactos de fakes.
- No emitir `game:paused` para errores, estrella u otras pausas automaticas, ni trasladar esa decision al handler.
- No cambiar contracts, textos, duraciones, frontend ni reglas de dominio; no crear sockets, timers reales, carpetas genericas o propietarios paralelos en aplicacion.
