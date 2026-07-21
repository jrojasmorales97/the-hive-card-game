---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: implementation
created_at: 2026-07-21T21:15:49Z
created_by_command: /sdd:implement
source_prompt: |-
  ## Proposito

  Ejecutar una TASK concreta con cambios minimos, correctos y verificables.

  ## Entrada

  Usa `.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-05.md;` solo para resolver una TASK. Acepta una ruta completa o basename exacto; sin argumento, usa la ultima TASK generada o citada en el hilo.

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
status: completed
task: /home/jromo/Projects/the-hive-card-game/.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-05.md
baseline: f35484c79e4cf6f1756b8994f2e4bd3da878d85f
---

# Resumen de ejecucion

Se cerró la extracción: progresión, terminales y ranking final son decisiones puras de `domain/progression.ts` y `domain/scoring.ts`; `index.ts` conserva la adaptación, emisión y scheduler. Todas las TI y la matriz canónica finalizaron correctamente.

# Alcance del cambio

Base: `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`

Archivos modificados:

- Añadidos: `apps/backend/src/domain/progression.ts`, `apps/backend/src/domain/progression.test.ts`, `apps/backend/src/domain/scoring.ts`, `apps/backend/src/domain/scoring.test.ts`, `.harness/implementations/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-05.md`.
- Modificados: `AGENTS.md`, `README.md`, `.harness/context/domain.md`, `.harness/context/architecture.md`, `apps/backend/src/domain/cards.ts`, `apps/backend/src/domain/cards.test.ts`, `apps/backend/src/domain/result.ts`, `apps/backend/src/domain/star.ts`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/gameStateMachine.test.ts`, `apps/backend/src/index.ts`, `.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-05.md`.
- Eliminados: `apps/backend/src/finalScoring.ts`, `apps/backend/src/finalScoring.test.ts`, `apps/backend/src/levelFlow.ts`, `apps/backend/src/levelFlow.test.ts`.
- Renombrados: Ninguno.

Cambios preexistentes:

- Estado inicial completo: `.harness/README.md`, `.harness/context/architecture.md`, `.harness/context/domain.md`, `.harness/reviews/.gitkeep`, `.harness/templates/agents.md`, `.harness/templates/implementation.md`, `.harness/templates/plan.md`, `.harness/templates/review.md`, `.opencode/agents/sdd-implement.md`, `.opencode/agents/sdd-init.md`, `.opencode/agents/sdd-plan.md`, `.opencode/agents/sdd-review.md`, `.opencode/commands/sdd:implement.md`, `.opencode/commands/sdd:init.md`, `.opencode/commands/sdd:plan.md`, `.opencode/commands/sdd:review.md`, `apps/backend/package.json`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/gameTiming.test.ts`, `apps/backend/src/gameTiming.ts`, `apps/backend/src/index.ts`, `apps/backend/src/privateState.test.ts`, `apps/backend/src/roundParticipants.test.ts`, `apps/backend/src/roundParticipants.ts`, `apps/backend/src/roundResolution.test.ts`, `apps/backend/src/roundResolution.ts`, `apps/backend/src/socketIntegration.test.ts`, `apps/backend/src/starResolution.test.ts`, `apps/backend/src/starResolution.ts`; y los no rastreados `.harness/designs/`, `.harness/implementations/2026-07-21/`, `.harness/specs/`, `.harness/tasks/`, `.harness/templates/design.md`, `.harness/templates/spec.md`, `.harness/templates/task.md`, `.opencode/agents/sdd-design.md`, `.opencode/agents/sdd-spec.md`, `.opencode/agents/sdd-task.md`, `.opencode/commands/sdd:design.md`, `.opencode/commands/sdd:spec.md`, `.opencode/commands/sdd:task.md`, `apps/backend/src/domain/`, `apps/backend/src/domainAdapter.test.ts`, `apps/backend/src/domainAdapter.ts`, `apps/backend/src/domainBoundaries.test.ts`, `apps/backend/src/domainBoundaries.ts`, `apps/backend/src/domainCoverageReporter.mjs`, `apps/backend/src/starAnimation.test.ts` y `apps/backend/src/starAnimation.ts`.
- Snapshots completos preedición: `git status --short`, `git diff --binary` y `git diff --cached --binary`; el snapshot binario no staged quedó en `/home/jromo/.local/share/opencode/tool-output/tool_f867fb87e001uHXcg5tZFhdtnh`. El snapshot staged fue vacío. Ningún cambio preexistente fue revertido; los cambios de `.harness/templates/` ya estaban presentes y no se modificaron en esta ejecución.

# TASK ejecutada

- `TI-01`: completada. Se caracterizaron recompensas/topes, efectos stale, avance, derrota, retry, victoria al nivel 12 y scoring determinista con historial, errores y tiempos fijos.
- `TI-02`: completada. `progression.ts` aplica recompensa una vez, usa topes 5/3, declara efectos de avance/readiness con expectativas completas, reutiliza setup para reparto y delega autorización a la máquina.
- `TI-03`: completada. `scoring.ts` conserva cálculo, CPU, mensajes, bandas, penalizaciones y orden estable sin importar la frontera wire.
- `TI-04`: completada. El shell aplica resultados, materializa efectos y traduce los eventos existentes; se retiraron `completeLevelOrGame`, `applyLevelReward`, `finalizeGameResults`, `finalScoring.ts` y `levelFlow.ts`.
- `TI-05`: completada. Las búsquedas no encuentran propietarios antiguos activos; `index.ts` no recalcula recursos, progreso, terminales ni ranking.
- `TI-06`: completada. Se actualizaron contexts, índice AGENTS y README con propietarios, invariantes, inicio manual y comandos reales.
- `TI-07`: completada. No se modificaron contracts, frontend ni plantillas; la matriz backend/frontend, checker, búsquedas y diff final pasan.

# Cambios realizados

- `completeLevel`, `advanceLevel`, `expireProgressionEffect` y `finishGame` devuelven estado, eventos y efectos inmutables con reloj, mazo y duraciones inyectados.
- La máquina canónica autoriza cierre de nivel, avance, liberación de nivel, derrota y victoria; callbacks con fase, lock o deadline distintos se rechazan.
- El ranking se calcula una vez sobre el `pileHistory` vigente con `completedAt` inyectado y se conserva en el estado funcional antes de serializarlo.
- La frontera conserva eventos, acks, snapshots, privacidad y el recorrido Socket.IO de derrota/retry/victoria.

# Tests y cobertura

- Backend: `67/67` tests pasan, incluidos nuevos tests deterministas de progresión/scoring y escenarios Socket.IO de derrota/retry/victoria.
- Frontend: `53/53` tests pasan como regresión de contratos observables.
- Cobertura del límite medible: líneas `97.59%`, branches `83.33%`, funciones `99.19%` sobre ocho archivos; supera `>=80%`.
- Cobertura frontend: líneas `93.29%`, branches `93.25%`, funciones `98.21%`.

# Documentacion actualizada

- `.harness/context/domain.md`: propietarios e invariantes finales de progresión, terminales y scoring.
- `.harness/context/architecture.md`: límite, scheduler, efectos y responsabilidades de `progression.ts` y `scoring.ts`.
- `AGENTS.md`: referencia al límite de dominio y máquina canónica.
- `README.md`: inicio manual por host y matriz de validación real.

# Comandos de validacion ejecutados

- `git rev-parse HEAD` -> `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`.
- `git status --short`; `git diff --binary`; `git diff --cached --binary` antes de editar.
- `docker compose run --build --rm --no-deps backend npm test` -> `67/67` pasa.
- `docker compose run --build --rm --no-deps backend npm run test:coverage` -> gate `97.59%/83.33%/99.19%` pasa.
- `docker compose run --build --rm --no-deps backend npm run build` -> pasa.
- `docker compose run --build --rm --no-deps frontend npm test` -> `53/53` pasa.
- `docker compose run --build --rm --no-deps frontend npm run test:coverage` -> `93.29%/93.25%/98.21%`.
- `docker compose run --build --rm --no-deps frontend npm run build` -> pasa.
- `npm run check:domain` -> pasa como prepaso de backend; `git diff --check` -> pasa; búsquedas de propietarios antiguos e imports/globales prohibidos -> sin hallazgos productivos.

# Bloqueos o desviaciones

Ninguno.
