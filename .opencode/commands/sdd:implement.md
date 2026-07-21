---
description: Ejecuta una TASK SDD lista y genera su reporte de implementacion.
agent: sdd-implement
subtask: true
---

## Proposito

Ejecutar una TASK concreta con cambios minimos, correctos y verificables.

## Entrada

Usa `$ARGUMENTS` solo para resolver una TASK. Acepta una ruta completa o basename exacto; sin argumento, usa la ultima TASK generada o citada en el hilo.

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
