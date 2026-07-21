---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: implementation
created_at: 2026-07-21T18:18:16Z
created_by_command: /sdd:implement
source_prompt: |-
  ## Proposito

  Ejecutar una TASK concreta con cambios minimos, correctos y verificables.

  ## Entrada

  Usa `.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-02.md` solo para resolver una TASK. Acepta una ruta completa o basename exacto; sin argumento, usa la ultima TASK generada o citada en el hilo.

  ## Precondiciones

  - Si el basename es ambiguo, la ruta no existe o no puedes resolver una TASK, deten la ejecucion y pide precision.
  - Acepta exclusivamente `type: task` con `status: ready`; cualquier otro tipo o estado bloquea la ejecucion.
  - Deben existir `AGENTS.md`, `.harness/context/domain.md`, `.harness/context/architecture.md` y `.harness/templates/implementation.md`.
  - Si falta contexto, pide ejecutar `/sdd:init`; si falta la plantilla, pide reinstalar el harness y deten el comando.

  ## Flujo

  - Empieza con `todowrite`: una tarea por cada `TI-*`, mas verificacion y reporte final; manten exactamente una tarea `in_progress` mientras quede trabajo.
  - Lee TASK completa, DESIGN, SPEC y contexto antes de tocar codigo; respeta estrictamente su alcance y decisiones.
  - Antes de editar, captura baseline con `git rev-parse HEAD`, estado con `git status --short` y snapshots completos de cambios preexistentes con `git diff --binary` y `git diff --cached --binary`.
  - Ejecuta por `TI-*` y slicing vertical, con cambios pequenos y verificables; no reviertas ni modifiques cambios ajenos fuera del alcance.
  - Anade o ajusta tests para codigo nuevo o modificado y actualiza documentacion cuando aplique.
  - Verifica cobertura minima `>= 80%` sobre codigo nuevo o modificado cuando sea medible. Si es medible y queda por debajo, termina `blocked`; si no es medible, documenta el motivo concreto y la validacion alternativa.
  - Si una duda material bloquea de verdad, usa `question` en un lote pequeno de un unico tema; no inventes la decision.
  - Actualiza `todowrite` en tiempo real y deja el resultado real de cada `TI-*` antes de cerrar.
  - Crea el artefacto solo al final, nunca como diario intermedio, en `.harness/implementations/yyyy-MM-dd/<id>-<slug>-task-<task_number>.md`.
  - Reutiliza `id`, `slug` y `task_number`; si ya existe una implementation de esa TASK en la fecha, usa `-attempt-2`, `-attempt-3`, etc. sin sobrescribir.
  - Usa `.harness/templates/implementation.md` como plantilla literal, manteniendo frontmatter, headings y orden; enlaza `task:` con la ruta completa.
  - Rellena `source_prompt` con el texto original del usuario; sin argumento, usa literalmente `inferred from thread context`. Escribe `created_at` en UTC ISO 8601 y no dejes placeholders.
  - Registra baseline, lista exhaustiva de archivos anadidos, modificados, renombrados o eliminados, estado inicial y snapshots completos de los diffs preexistentes, resultados por `TI-*`, tests, cobertura, documentacion y todos los comandos de validacion.
  - El status de implementation es `completed` o `blocked`. Solo si termina `completed`, actualiza exclusivamente `task.status` a `implemented`; si termina `blocked`, deja TASK en `ready`.
  - Usa `Ninguno` o `No aplica` cuando corresponda y no modifiques otros artefactos previos.

  ## Restricciones

  - No aceptes planes monoliticos ni modifiques otros artefactos previos.
  - No amplies alcance, no reviertas cambios ajenos y no marques `completed` con `TI-*` o validaciones pendientes.

  ## Artefacto

  - Implementation trazable a una TASK.

  ## Salida

  - La primera linea debe ser exactamente `ARTEFACT_PATH: <ruta>`.
  - La segunda linea debe ser exactamente `ARTEFACT_TYPE: implementation`.
  - La tercera linea debe ser exactamente `TASK_PATH: <ruta>`.
  - Despues usa solo bullets breves para baseline, cambios, tests, cobertura y bloqueos o desviaciones; no anadas texto antes de esas lineas.
status: blocked
task: /home/jromo/Projects/the-hive-card-game/.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-02.md
baseline: f35484c79e4cf6f1756b8994f2e4bd3da878d85f
---

# Resumen de ejecucion

Se implementaron y validaron los slices de setup y ciclo de ronda. El cierre queda bloqueado exclusivamente por la documentacion aplicable: el contrato del subagente prohíbe editar artefactos fuera de esta implementation y la TASK, mientras `domain.md` y `architecture.md` necesitan reflejar que setup y ronda ya son propietarios activos.

# Alcance del cambio

Base: `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`

Archivos modificados:

- Añadidos: `apps/backend/src/domain/setup.ts`, `apps/backend/src/domain/setup.test.ts`, `apps/backend/src/domain/round.ts`, `apps/backend/src/domain/round.test.ts`.
- Modificados: `apps/backend/package.json`, `apps/backend/src/domain/result.ts`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/index.ts`.
- Eliminados: `apps/backend/src/roundParticipants.ts`, `apps/backend/src/roundParticipants.test.ts`.
- Renombrados: Ninguno.
- Artefacto añadido: `.harness/implementations/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-02.md`.

Cambios preexistentes:

- Baseline capturado antes de editar: `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`.
- Estado inicial completo: cambios tracked en `.harness/README.md`, `.harness/context/{architecture,domain}.md`, `.harness/reviews/.gitkeep`, `.harness/templates/{agents,implementation,plan,review}.md`, `.opencode/agents/*`, `.opencode/commands/*`, `apps/backend/package.json`, `apps/backend/src/{gameStateMachine,index,privateState.test,roundParticipants,roundParticipants.test}.ts`; y entradas untracked en `.harness/{designs,implementations/2026-07-21,specs,tasks,templates/{design,spec,task}.md}`, `.opencode/{agents,commands}/{sdd-design,sdd-spec,sdd-task}.md`, `apps/backend/src/domain/`, `domainAdapter{,.test}.ts`, `domainBoundaries{,.test}.ts` y `domainCoverageReporter.mjs`.
- Snapshot tracked completo capturado antes de editar con `git diff --binary`; snapshot staged completo con `git diff --cached --binary` (vacío). La salida íntegra quedó capturada por la ejecución en `/home/jromo/.local/share/opencode/tool-output/tool_f85df021a001hGj6upBMqyb0S9`; no se revirtió ningún cambio de ese snapshot.
- Los cambios preexistentes de `apps/backend/src/domain/`, adaptador, checker, cobertura y participantes se conservaron y se usaron como fundación de TASK 01.

# TASK ejecutada

- TI-01 — Completada: se añadieron caracterizaciones deterministas de balance 2–8, setup/retry, reparto, ready/CPU/manos vacías, pausa y expiración stale; las integraciones Socket.IO existentes continúan pasando.
- TI-02 — Completada: `domain/setup.ts` es dueño de balance, recompensas, inicio, retry y reparto inmutable con `now`, mazo y duración inyectados.
- TI-03 — Completada: `domain/round.ts` decide ready/unready, pausa, countdown y expiraciones mediante `evaluateGameTransition()` y poblaciones nombradas.
- TI-04 — Completada: `index.ts` adapta resultados una vez, conserva emisiones/acks/logs y materializa únicamente efectos temporales declarativos.
- TI-05 — Completada: `game:start`, `game:retry`, `player:ready`, `game:pause-request`, dealing y callbacks de dealing/countdown usan dominio; se retiró `roundParticipants.ts` con su test.
- TI-06 — Completada para código: no quedan referencias activas a `startGameInRoom`, `applyRoundReadyRequest`, `pauseRoundForReady` ni `roundParticipants`; checker confirma ausencia de reloj, azar y timers en `domain/`.

# Cambios realizados

- Setup puro crea el estado inicial/retry, mapa de recompensas, manos ordenadas y efecto `dealing-expired` con deadline y expectativas de fase/lock.
- Ronda pura aplica ready/pausa sin mutar entradas, sincroniza CPU, excluye manos vacías del quorum y emite el countdown declarativo.
- La máquina canónica incorpora `countdown-started` con duración inyectada; callbacks stale se rechazan por fase, razón y deadline exactos.
- El shell conserva Socket.IO, timers, RNG, versiones, logs y serialización; `materializeDomainEffects()` es el único scheduler de los nuevos efectos.
- Los scripts backend incluyen tests bajo `src/domain/*.test.ts` para que el gate mida y ejecute los slices nuevos.

# Tests y cobertura

- `docker compose run --build --rm --no-deps backend npm test`: 68/68 tests pasan.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`: 68/68 pasan; límite lógico medido en 4 archivos: líneas 97.53%, branches 86.34%, funciones 100.00% (>= 80%).
- `docker compose run --build --rm --no-deps frontend npm test`: 53/53 tests pasan.
- `docker compose run --build --rm --no-deps frontend npm run test:coverage`: líneas 93.29%, branches 93.25%, funciones 98.21%.

# Documentacion actualizada

No aplicada. `.harness/context/domain.md` y `.harness/context/architecture.md` ya tenían cambios preexistentes de fundación, pero aún describen setup/ronda como propietarios futuros. Actualizarlos es necesario para cerrar la TASK, pero está prohibido por la restricción operativa de no editar artefactos fuera de implementation y TASK.

# Comandos de validacion ejecutados

- `git rev-parse HEAD`
- `git status --short`
- `git diff --binary`
- `git diff --cached --binary`
- `docker compose run --build --rm --no-deps backend npm run build`
- `docker compose run --build --rm --no-deps backend npm test`
- `docker compose run --build --rm --no-deps backend npm run test:coverage`
- `docker compose run --build --rm --no-deps frontend npm test`
- `docker compose run --build --rm --no-deps frontend npm run test:coverage`
- `docker compose run --build --rm --no-deps frontend npm run build`
- Búsquedas de símbolos retirados y de `Date.now`/`Math.random`/timers en `apps/backend/src/domain/`.

# Bloqueos o desviaciones

- Bloqueo: documentación aplicable pendiente por conflicto entre la TASK (requiere actualizar contexto) y la restricción superior del subagente (solo permite editar implementation y TASK). Por ello el artefacto queda `blocked` y la TASK permanece `ready`.
- Desviaciones funcionales: Ninguna. Contratos Socket.IO, acks, emisiones, logs, versiones y snapshots se validaron mediante la suite de integración existente.
