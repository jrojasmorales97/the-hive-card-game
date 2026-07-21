---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: implementation
created_at: 2026-07-21T18:39:55Z
created_by_command: /sdd:implement
source_prompt: |-
  ## Proposito

  Ejecutar una TASK concreta con cambios minimos, correctos y verificables.

  ## Entrada

  Usa `.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-03.md` solo para resolver una TASK. Acepta una ruta completa o basename exacto; sin argumento, usa la ultima TASK generada o citada en el hilo.

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
task: /home/jromo/Projects/the-hive-card-game/.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-03.md
baseline: f35484c79e4cf6f1756b8994f2e4bd3da878d85f
---

# Resumen de ejecucion

Se migró el slice de cartas a `domain/cards.ts`. El comando, la penalización, los descartes, los outcomes y las expiraciones se resuelven sobre una copia inmutable y el shell solo adapta estado, programa efectos y traduce hechos a los eventos/logs existentes.

# Alcance del cambio

Base: `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`

Archivos modificados:

- Añadidos: `apps/backend/src/domain/cards.ts`, `apps/backend/src/domain/cards.test.ts`, esta implementation.
- Modificados: `apps/backend/src/domain/result.ts`, `apps/backend/src/index.ts`, `apps/backend/src/gameTiming.ts`, `apps/backend/src/gameTiming.test.ts`, `apps/backend/src/roundResolution.ts`, `apps/backend/src/roundResolution.test.ts`, `.harness/context/domain.md`, `.harness/context/architecture.md` y la TASK.
- Renombrados: Ninguno.
- Eliminados: Ninguno; se retiraron los símbolos `playCardInRoom`, `resolveErrorAndDiscard`, `discardLowerCards` y `shouldResolveAfterErrorOverlay` de sus archivos existentes.

Cambios preexistentes:

- Estado inicial no staged: modificaciones en `.harness/README.md`, los dos contextos, templates y comandos/agentes SDD, `apps/backend/package.json`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/index.ts`, `apps/backend/src/privateState.test.ts`; eliminaciones de review/plan/template/agent/comando históricos y `roundParticipants.*`; y altas no rastreadas de artefactos SDD, `domain/**`, `domainAdapter.*`, `domainBoundaries.*` y `domainCoverageReporter.mjs`.
- No había cambios staged (`git diff --cached --binary` vacío).
- Se capturaron antes de editar los snapshots completos con `git status --short`, `git diff --binary` y `git diff --cached --binary`; el snapshot no staged fue el estado de migración previo de TASK 01/02 y se preservó sin revertirlo. La ejecución no tocó los artefactos históricos preexistentes fuera de los dos contextos requeridos por esta TASK.

# TASK ejecutada

- TI-01 — Completada. Se añadieron fixtures deterministas para rechazo de carta ajena/no mínima, jugada válida, múltiples bloqueantes, suelo de vidas, contador de error, historial, inmutabilidad y outcomes de pausa, derrota y nivel completo.
- TI-02 — Completada. `domain/cards.ts` usa `evaluateGameTransition()`, `now` y duraciones inyectadas; devuelve `DomainResult` inmutable con hechos discriminados y efectos declarativos con expectativas stale.
- TI-03 — Completada. `game:play-card` valida el wire payload y llama una vez a `playCardWithDomain`; `index.ts` adapta el resultado, emite los payloads/logs existentes y materializa efectos sin recalcular cartas bloqueantes ni outcomes.
- TI-04 — Completada. Se retiraron los propietarios antiguos de carta/error/descarte y su test; la lógica de resolución tras error quedó absorbida por `domain/cards.ts`. `roundResolution.ts` se conserva exclusivamente para el settlement de estrella, fuera de este slice.
- TI-05 — Completada. Los hechos de continuidad llevan a pausa, nivel completo o derrota; el flujo de progresión consume esos hechos y la CPU solo se programa tras una jugada aceptada que sigue activa.
- TI-06 — Completada. La búsqueda no encuentra `playCardInRoom`, `resolveErrorAndDiscard`, `discardLowerCards` ni `shouldResolveAfterErrorOverlay`; el único `getRoundResolutionOutcome` activo pertenece al flujo de estrella aún no migrado.

# Cambios realizados

- Se añadió el propietario puro `playCard`, `expireCardEffect` y `scheduleRoundCompletion` en `domain/cards.ts`.
- Se ampliaron `DomainEvent` con penalización, cada descarte y outcome de carta; los efectos `error-expired`, `round-flip-expired` y `round-unflip-expired` incluyen fase, lock y deadline esperados.
- Se sustituyó el handler y el turno CPU por `playCardWithDomain`, `translateCardEvents` y `materializeCardEffects`.
- Se conserva el orden funcional observable: log de carta, emisión/log de error y descartes, snapshot; el resultado de error mantiene `game:error-penalty`, `game:paused`, `game:over`, cierre de nivel, versiones y privacidad existentes.

# Tests y cobertura

- Backend: 71/71 tests pasan, incluyendo integración Socket.IO de jugada correcta, error/pausa, derrota/retry, victoria y estrella.
- Frontend: 53/53 tests pasan como regresión de contrato.
- Cobertura backend del límite medible: líneas 98.07%, branches 85.15%, funciones 100.00%; `src/domain/cards.ts`: líneas 100.00%, branches 81.08%, funciones 100.00%.
- Cobertura frontend: líneas 93.29%, branches 93.25%, funciones 98.21%.

# Documentacion actualizada

- `.harness/context/domain.md`: propietario de cartas e invariantes de mínimo propio, bloqueantes, penalización, efectos stale y continuidad.
- `.harness/context/architecture.md`: límite, scheduler y propietario único de `domain/cards.ts`.

# Comandos de validacion ejecutados

- `git rev-parse HEAD`
- `git status --short`
- `git diff --binary`
- `git diff --cached --binary`
- `docker compose run --build --rm --no-deps backend npm test`
- `docker compose run --build --rm --no-deps backend npm run test:coverage`
- `docker compose run --build --rm --no-deps backend npm run build`
- `docker compose run --build --rm --no-deps frontend npm test`
- `docker compose run --build --rm --no-deps frontend npm run test:coverage`
- `docker compose run --build --rm --no-deps frontend npm run build`
- `git diff --check`
- Búsquedas de símbolos antiguos con `grep` del repositorio.

# Bloqueos o desviaciones

Ninguno.
