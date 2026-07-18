---
description: Ejecuta un plan SDD listo y genera su reporte de implementacion.
agent: sdd-implement
subtask: true
---

Usa `$ARGUMENTS` solo para resolver un `plan` explicito.

Primero resuelve el plan objetivo:
- si `$ARGUMENTS` incluye una ruta completa o basename exacto de un `plan`, usalo
- si `$ARGUMENTS` esta vacio, usa el ultimo `plan` generado o citado en el hilo
- acepta solo artefactos de tipo `plan`
- si el basename es ambiguo, deten la ejecucion y pide precision
- si no puedes resolver un `plan` del hilo o la ruta no existe, deten la ejecucion
- si `plan.status` no es `ready`, deten la ejecucion

Tu trabajo es ejecutar el plan con cambios minimos, correctos y verificables.

Reglas:
- empieza usando `todowrite` y carga una tarea por cada `TI-*`, mas verificacion y reporte final
- revisa el plan objetivo completo antes de tocar codigo
- lee `AGENTS.md`, `.harness/context/domain.md` y `.harness/context/architecture.md` antes de implementar
- si falta ese contexto, pide ejecutar `/sdd:init` antes de continuar
- si falta `.harness/templates/implementation.md`, deten el comando y explica que el proyecto necesita reinstalar el harness local
- antes de editar, captura un baseline con `git rev-parse HEAD`
- antes de editar, captura cambios preexistentes con `git diff --name-only` y `git status --short`
- respeta estrictamente el alcance del plan
- implementa por `TI-*`, manteniendo el slicing vertical del plan
- anade o ajusta tests para el codigo nuevo o modificado
- verifica una cobertura minima del 80% sobre el codigo nuevo o modificado, o explica el bloqueo concreto
- actualiza documentacion cuando aplique
- manten exactamente una tarea `in_progress` en `todowrite`
- si una duda bloquea la ejecucion de verdad, usa `question` en un lote pequeno centrado en ese unico topic
- crea el artefacto de salida solo al final, nunca como diario intermedio
- genera `.harness/implementations/yyyy-MM-dd/<id>-<slug>.md`
- usa `.harness/templates/implementation.md` como plantilla literal
- reutiliza `id` y `slug` del plan
- si hay una implementacion del mismo plan en la misma fecha, crea `-attempt-2`, `-attempt-3`, etc.
- rellena `source_prompt` con el texto original del usuario; si no hubo argumento, usa una frase literal como `inferred from thread context`
- usa `created_by_command: /sdd:implement`
- escribe `created_at` en UTC ISO 8601
- `status` del artefacto es `completed` o `blocked`
- si `status` es `completed`, actualiza solo `plan.status` a `implemented`
- si `status` es `blocked`, deja `plan.status` en `ready`
- registra `baseline`, una lista exhaustiva de archivos anadidos, modificados, renombrados o eliminados, cambios preexistentes y comandos de validacion ejecutados
- no modifiques otros artefactos previos
- usa `Ninguno` o `No aplica` cuando corresponda
- actualiza `todowrite` durante la ejecucion y antes de cerrar deja reflejado el resultado real de cada `TI-*`

Antes de cerrar:
- el mensaje final al hilo principal debe empezar exactamente con `ARTEFACT_PATH: <ruta>`
- en la segunda linea indica `ARTEFACT_TYPE: implementation`
- en la tercera linea indica `PLAN_PATH: <ruta-del-plan>`
- despues usa solo bullets breves para baseline, cambios, tests, cobertura y bloqueos o desviaciones
