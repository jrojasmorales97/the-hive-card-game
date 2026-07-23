---
id: c4e8a1f2
slug: encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory
type: task
created_at: 2026-07-23T08:57:53Z
created_by_command: /sdd:task
source_prompt: |-
  Quiero encapsular la infraestructura backend detras de puertos manteniendo el comportamiento in-memory.

  Alcance:
  - Encapsular stores de salas y jugadores.
  - Crear adaptadores para reloj, barajado y scheduler.
  - Centralizar creacion, cancelacion y reemplazo de timers.
  - Colocar implementaciones concretas bajo `infrastructure/` por capacidad operativa, no por framework o patron generico.
  - Definir ownership y cleanup de recursos.
  - Permitir tests deterministas con adaptadores fake.

  Actualizacion del contexto del proyecto:
  - Registrar en `architecture.md` puertos, adaptadores, ownership de efectos y reglas de cleanup.
  - Actualizar `domain.md` solo si se descubre una decision funcional, no con detalles tecnicos.
  - Mantener `AGENTS.md` como indice hacia adaptadores y comandos.
  - Automatizar los limites tecnicos desde tooling local del repo.

  Restricciones:
  - No anadir base de datos.
  - No cambiar balance ni reglas.
  - No esconder efectos en funciones aparentemente puras.
  - No especializar comandos SDD.

  Validacion:
  - Domain y application no dependen de infraestructura concreta.
  - Los tests controlan reloj, random y scheduler.
  - No quedan timers huerfanos en los flujos cubiertos.
  - Los checks automatizados permiten `infrastructure -> application` y rechazan imports de infraestructura desde application/domain.
status: implemented
spec: .harness/specs/2026-07-23/c4e8a1f2-encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory.md
design: .harness/designs/2026-07-23/c4e8a1f2-encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory.md
task_number: 02
task_count: 02
---

# Objetivo

Centralizar de extremo a extremo las directivas de trabajo diferido y hacer que el scheduler posea espera, entrega, reemplazo y cleanup hasta shutdown, con pruebas deterministas de todos los triggers y sin alterar el orden observable Socket.IO.

# Alcance y evidencia

- Aplican `CA-01`, `CA-03`, `CA-04`, `CA-05`, `CA-06` y `CA-07` de la SPEC, cerrando la validacion integral despues de TASK 01.
- Formalizar en resultados de aplicacion las directivas aprobadas `replace`, `cancel` y `cancel-room`; `dispatchApplicationResult` sera el unico materializador despues del commit, con orden cancelaciones, eventos actuales y reemplazos.
- Eliminar las cancelaciones directas de `RoomUseCases.remove` y `StarUseCases.execute`, asi como cualquier scheduling directo restante en casos de uso; retry declara `cancel-room` antes del nuevo `dealing-expired`, la ultima persona declara `cancel-room` y el consenso de estrella declara `cancel` de `cpu-turn`.
- Completar `ProcessScheduler` bajo `infrastructure/scheduling/` con identidad `{ roomCode, trigger }`, generacion, cancelacion por clave/sala/global y ownership de timeout y entrega diferida mediante un runtime de timers interno e inyectable.
- La evidencia actual esta en `application/dispatcher.ts:6-10`, `roomUseCases.ts:102-110`, `starUseCases.ts:103-125`, `gameUseCases.ts:80-91`, `infrastructure/scheduling/processScheduler.ts:4-31` e `index.ts:133-138,307-319`; la entrega por `setImmediate` no esta registrada y `clearRoomTimers` es un no-op.
- Conservar las guardas stale de `EffectUseCases.materialize` y cubrir todos los triggers aprobados sin red, reloj real, random real, timers reales ni esperas reales.

# Criterios de aceptacion

- **CA-03 / CA-04:** cada trabajo diferido se expresa como `replace`, `cancel` o `cancel-room` en el resultado; el dispatcher aplica cancelaciones sobre estado ya comprometido, publica eventos en el orden actual y despues registra reemplazos, sin scheduler invocado desde dominio, helpers puros o casos de uso.
- **CA-03:** `replace` cancela la identidad anterior antes de registrar la nueva; delete de ultima persona y retry limpian la sala, retry registra despues su nuevo `dealing-expired`, y cierre de consenso de estrella cancela especificamente `cpu-turn`.
- **CA-03 / CA-05:** `ProcessScheduler` posee timeout y entrega pendiente, conserva clave/generacion, ejecuta una vez solo la entrada activa y soporta cancelacion por clave, sala y global incluso durante la ventana previa a `run`.
- **CA-05:** `DeterministicScheduler` conserva trabajos por clave, orden estable para empates e historial inspeccionable de reemplazos, cancelaciones y ejecuciones; permite ejecutar uno o todos los trabajos vencidos y comparte escenarios de conformidad con `ProcessScheduler`.
- **CA-03:** reset y stop cancelan globalmente antes de limpiar repositorio/sesiones o cerrar Socket.IO; expiry normal, retry, delete, desconexion cubierta, reset y stop no dejan trabajo pendiente, espera ni entrega huerfana.
- **CA-01 / CA-03:** callbacks antiguos por version, retry, fase, lock/deadline reemplazado o sala eliminada se rechazan sin guardar, publicar, mutar ni registrar trabajo nuevo; se conservan acks, eventos, privacidad, versiones y orden wire.
- **CA-06 / CA-07:** el checker y gate cubren la implementacion final, `architecture.md` registra ownership y matriz de cleanup, y `AGENTS.md` queda como indice breve sin cambiar `domain.md`, README ni comandos SDD.

# Tareas de implementacion

- **TI-01 — Caracterizar orden y lifecycle:** fijar el orden commit/cancel/eventos/replace y los flujos actuales de todos los triggers: `dealing-expired`, `countdown-expired`, `error-expired`, `round-flip-expired`, `round-unflip-expired`, `next-level-expired`, `level-ready-expired`, `cpu-turn` y `star-settled`.
- **TI-02 — Declarar directivas en aplicacion:** extender el resultado con `replace`, `cancel` y `cancel-room`, adaptar dispatcher y casos de uso, y retirar llamadas directas al scheduler; probar especialmente retry, sala vacia, consenso/cierre de estrella y continuaciones CPU.
- **TI-03 — Completar el scheduler de proceso:** encapsular primitivas Node en un runtime inyectable, registrar espera y entrega con generacion, implementar cleanup por clave/sala/global y garantizar retiro exactamente una vez antes o despues de ejecucion.
- **TI-04 — Implementar el scheduler determinista:** co-localizar el fake bajo scheduling con reloj controlado, historial y ejecucion ordenada; aplicar a ambos schedulers una suite de conformidad de replace, cancel, cancel-room, cancel global, empates, ejecucion unica y carrera previa a entrega.
- **TI-05 — Integrar lifecycle y callbacks:** cablear cancelacion global en `resetServerForTests` y `stopServer` antes del resto del cleanup, eliminar `clearRoomTimers`, mantener guardas stale y verificar que cada resultado materializado vuelve por el dispatcher unico.
- **TI-06 — Cubrir flujos sin recursos huerfanos:** migrar fixtures de aplicacion/callbacks al reloj, random y scheduler deterministas; afirmar pendientes vacios donde corresponda y ausencia de writes/publicaciones/directivas nuevas ante callbacks stale.
- **TI-07 — Cerrar tooling y documentacion:** incluir scheduling medible en cobertura, ejecutar checker sobre arbol real, completar ownership/matriz de cleanup en `architecture.md` y actualizar `AGENTS.md` solo como indice hacia puertos, capacidades y comandos.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar `docker compose run --build --rm --no-deps backend npm run check:layers`, `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Ejecutar `docker compose run --build --rm --no-deps frontend npm test`, `docker compose run --build --rm --no-deps frontend npm run test:coverage` y `docker compose run --build --rm --no-deps frontend npm run build` para confirmar que los contratos compartidos no cambiaron.
- Exigir `>= 80%` en lineas, branches y funciones sobre la logica medible nueva o modificada, incluida infraestructura de scheduling; no reducir la linea base observada de 98.23%/85.83%/97.49% para dominio/aplicacion.
- Ejecutar la suite de conformidad de schedulers y tests de dispatcher/casos de uso para orden exacto, replace, cancelaciones, retry, delete, estrella, lifecycle, empates y carrera timeout-entrega; comprobar `pendingJobs.length === 0` al terminar cada flujo aplicable.
- Ejecutar toda la integracion Socket.IO y comparar literalmente acks, eventos, logs, snapshots, privacidad, versiones y orden; validar que callbacks stale no cambian repositorio, no publican y no programan.
- Repetir build mediante Docker por el `EACCES` observado en artefactos host de `apps/backend/dist/`; no resolverlo cambiando permisos, scripts ni alcance funcional.

# Documentacion aplicable

- Completar `.harness/context/architecture.md` con los cinco puertos, implementaciones por capacidad, clave `{ roomCode, trigger }`, orden del dispatcher, ownership de timeout/entrega, runtime inyectable y matriz de cleanup para replace, expiry, retry, delete, reset y stop.
- No modificar `.harness/context/domain.md`: el DESIGN confirma que no existe una nueva decision funcional y prohibe introducir detalles de puertos, adapters o timers.
- Actualizar `AGENTS.md` unicamente como indice hacia `application/ports/`, `infrastructure/memory|runtime|scheduling`, el checker y los comandos canonicos, sin duplicar contratos tecnicos.
- No modificar README porque se conservan `check:layers`, `check:domain`, test, cobertura y build; no modificar `.opencode/commands/`.

# Riesgos y restricciones

- Mitigar alteraciones de orden separando cancelaciones, publicaciones y reemplazos y comparando secuencias Socket.IO exactas; retry debe cancelar toda la sala antes de registrar el nuevo dealing.
- Mitigar carreras de vencimiento con ownership de espera/entrega, generaciones y guardas stale de version/fase/lock/deadline; el fake y produccion deben pasar los mismos escenarios para evitar deriva.
- Mitigar cleanup excesivo solo donde el DESIGN lo declara: cancelacion por sala en retry/delete y cancelacion especifica de `cpu-turn` en estrella; no introducir politicas temporales nuevas.
- No anadir persistencia, dependencias, reglas, balance, contratos, frontend funcional, cambios Docker/Render, carpetas genericas ni efectos ocultos; no especializar comandos SDD.
