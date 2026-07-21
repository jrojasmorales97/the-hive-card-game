---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: implementation
created_at: 2026-07-21T18:53:48Z
created_by_command: /sdd:implement
source_prompt: |-
  Ejecutar una TASK concreta con cambios minimos, correctos y verificables.

  Usa `.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-04.md` solo para resolver una TASK. Acepta una ruta completa o basename exacto; sin argumento, usa la ultima TASK generada o citada en el hilo.

  Precondiciones: acepta exclusivamente `type: task` con `status: ready`; deben existir `AGENTS.md`, `.harness/context/domain.md`, `.harness/context/architecture.md` y `.harness/templates/implementation.md`.

  Empieza con `todowrite`: una tarea por cada `TI-*`, mas verificacion y reporte final; manten exactamente una tarea `in_progress` mientras quede trabajo. Lee TASK completa, DESIGN, SPEC y contexto antes de tocar codigo. Antes de editar, captura baseline con `git rev-parse HEAD`, estado con `git status --short` y snapshots completos con `git diff --binary` y `git diff --cached --binary`. Ejecuta por `TI-*`, anade tests, verifica cobertura minima `>= 80%`, actualiza documentacion aplicable y usa `question` solo para una duda material bloqueante.

  Crea el artefacto solo al final en `.harness/implementations/yyyy-MM-dd/<id>-<slug>-task-<task_number>.md`, usa la plantilla literal y enlaza la ruta completa de TASK. Registra baseline, archivos, cambios preexistentes, resultados TI, tests, cobertura, documentacion y comandos. El status es `completed` o `blocked`; solo al completar actualiza `task.status` a `implemented`.

  La salida debe comenzar exactamente con `ARTEFACT_PATH: <ruta>`, `ARTEFACT_TYPE: implementation` y `TASK_PATH: <ruta>`; despues usa solo bullets breves.
status: completed
task: /home/jromo/Projects/the-hive-card-game/.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-04.md
baseline: f35484c79e4cf6f1756b8994f2e4bd3da878d85f
---

# Resumen de ejecucion

Se migraron propuesta, voto, consenso, consumo, preview y settlement de estrella a `domain/star.ts`; `starAnimation.ts` conserva exclusivamente la espera visual de acks/desconexion/deadline. Todos los TI-01 a TI-06 y las validaciones requeridas terminaron correctamente.

# Alcance del cambio

Base: `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`

Archivos modificados:

- Aniadidos: `apps/backend/src/domain/star.ts`, `apps/backend/src/domain/star.test.ts`, `apps/backend/src/starAnimation.ts`, `apps/backend/src/starAnimation.test.ts`, `.harness/implementations/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-04.md`.
- Modificados: `.harness/context/domain.md`, `.harness/context/architecture.md`, `apps/backend/src/domain/model.ts`, `apps/backend/src/domain/result.ts`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/gameTiming.ts`, `apps/backend/src/gameTiming.test.ts`, `apps/backend/src/index.ts`, `.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-04.md`.
- Eliminados: `apps/backend/src/roundResolution.ts`, `apps/backend/src/roundResolution.test.ts`, `apps/backend/src/starResolution.ts`, `apps/backend/src/starResolution.test.ts`.
- Renombrados: Ninguno.

Cambios preexistentes:

- Estado inicial completo: `.harness/README.md`, `.harness/context/architecture.md`, `.harness/context/domain.md`, `.harness/reviews/.gitkeep`, `.harness/templates/agents.md`, `.harness/templates/implementation.md`, `.harness/templates/plan.md`, `.harness/templates/review.md`, `.opencode/agents/sdd-implement.md`, `.opencode/agents/sdd-init.md`, `.opencode/agents/sdd-plan.md`, `.opencode/agents/sdd-review.md`, `.opencode/commands/sdd:implement.md`, `.opencode/commands/sdd:init.md`, `.opencode/commands/sdd:plan.md`, `.opencode/commands/sdd:review.md`, `apps/backend/package.json`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/gameTiming.test.ts`, `apps/backend/src/gameTiming.ts`, `apps/backend/src/index.ts`, `apps/backend/src/privateState.test.ts`, `apps/backend/src/roundParticipants.test.ts`, `apps/backend/src/roundParticipants.ts`, `apps/backend/src/roundResolution.test.ts`, `apps/backend/src/roundResolution.ts`, y los no rastreados `.harness/designs/`, `.harness/implementations/2026-07-21/`, `.harness/specs/`, `.harness/tasks/`, `.harness/templates/design.md`, `.harness/templates/spec.md`, `.harness/templates/task.md`, `.opencode/agents/sdd-design.md`, `.opencode/agents/sdd-spec.md`, `.opencode/agents/sdd-task.md`, `.opencode/commands/sdd:design.md`, `.opencode/commands/sdd:spec.md`, `.opencode/commands/sdd:task.md`, `apps/backend/src/domain/`, `apps/backend/src/domainAdapter.test.ts`, `apps/backend/src/domainAdapter.ts`, `apps/backend/src/domainBoundaries.test.ts`, `apps/backend/src/domainBoundaries.ts`, `apps/backend/src/domainCoverageReporter.mjs`.
- Snapshots completos preedicion: se ejecutaron `git diff --binary` y `git diff --cached --binary` junto con `git status --short`; el segundo no produjo diff. El snapshot binario completo de trabajo quedo capturado por la ejecucion en `/home/jromo/.local/share/opencode/tool-output/tool_f85fbd8cb001sXYFZzuZY3Hcya`; no se revirtio ningun cambio preexistente.

# TASK ejecutada

- `TI-01`: completada. Se caracterizaron propuesta, CPU, voto repetido, cancelacion/rechazo, poblaciones de consenso/settlement, preview, stale/retry y coordinacion de acks/desconexion.
- `TI-02`: completada. `domain/star.ts` produce resultados inmutables para propuesta, voto, consumo, preview y settlement idempotente, autorizado por la maquina canonica.
- `TI-03`: completada. `starAnimation.ts` registra solo sockets humanos que recibieron preview y resuelve acks/desconexion; no conoce ni muta estado funcional.
- `TI-04`: completada. Los cinco handlers y el timeout aplican resultados una vez y traducen los eventos/logs existentes.
- `TI-05`: completada. Se retiraron los propietarios antiguos de preview/aplicacion/consenso/consumo/settlement en `index.ts`, `gameTiming.ts`, `starResolution.ts` y el helper sin consumidores `roundResolution.ts`.
- `TI-06`: completada. El dominio aplica el preview tambien a manos desconectadas; `starAnimation.ts` no escribe manos/estrellas y las pruebas Socket.IO conservan snapshots y privacidad.

# Cambios realizados

- `DomainGame` conserva la resolucion pendiente de estrella como estado funcional interno; el adaptador la fusiona sin sockets ni metadata de transporte.
- El consenso consume una estrella una sola vez, fija lock/deadline de estrella y conserva el preview sin mutar manos.
- Settlement comprueba fase, razon y deadline originales, aplica exactamente el preview una vez, declara pausa o cierre y rechaza callbacks stale/repetidos.
- La coordinacion visual recibe el preview ya decidido y solo espera confirmaciones humanas conectadas, desconexion o timeout antes de devolver el comando de settlement.

# Tests y cobertura

- `apps/backend/src/domain/star.test.ts`: cinco escenarios deterministas de inmutabilidad, consenso, CPU, cancelacion/rechazo, preview, desconectados, settlement, idempotencia y staleness.
- `apps/backend/src/starAnimation.test.ts`: acks, duplicados, irrelevantes y desconexion sin mutacion funcional.
- Regresion Socket.IO de estrella: propuesta, rechazo, cancelacion, consenso, `game:star-used`, privacidad del preview y acks completos pasan.
- Cobertura medible del limite: lineas `97.35%`, branches `84.32%`, funciones `98.96%` sobre 6 archivos; supera el minimo `>= 80%`.

# Documentacion actualizada

- `.harness/context/domain.md`: propietarios, poblaciones distintas, consumo unico, preview y settlement idempotente de estrella.
- `.harness/context/architecture.md`: frontera entre `domain/star.ts` y `starAnimation.ts` y prohibicion de mutar estado funcional desde la coordinacion visual.

# Comandos de validacion ejecutados

- `git rev-parse HEAD` -> `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`.
- `git status --short`; `git diff --binary`; `git diff --cached --binary` antes de editar.
- `docker compose run --build --rm --no-deps backend npm test` -> pasa `68/68` (ejecutado finalmente tras corregir la caracterizacion).
- `docker compose run --build --rm --no-deps backend npm run test:coverage` -> pasa, gate de dominio `97.35%/84.32%/98.96%`.
- `docker compose run --build --rm --no-deps backend npm run build` -> pasa.
- `npm run check:domain` -> pasa como prepaso de test, cobertura y build.
- `git diff --check` -> pasa antes de crear este reporte.

# Bloqueos o desviaciones

- Ninguno. La primera ejecucion de tests detecto una expectativa unitaria de cancelacion con actor sin cartas y una transicion prematura de nivel; se corrigieron antes de las validaciones finales sin ampliar alcance.
