---
description: Genera TASKs implementables desde un DESIGN aprobado.
agent: sdd-task
---

## Proposito

Descomponer un DESIGN aprobado en una o varias TASK verticales listas para implementar.

## Entrada

Usa `$ARGUMENTS` solo para resolver un DESIGN. Acepta una ruta completa o basename exacto; sin argumento, usa el ultimo DESIGN citado en el hilo.

## Precondiciones

- Si el basename es ambiguo, la ruta no existe o no puedes resolver un DESIGN, deten el comando y pide precision.
- La entrada debe tener `type: design` y `status: approved`; cualquier otro tipo o estado bloquea TASK.
- Deben existir contexto SDD y `.harness/templates/task.md`; si faltan, pide init o reinstalacion segun corresponda.

## Flujo

- Empieza con `todowrite`: contexto, resolucion de DESIGN, slicing, escritura, validacion y cierre; manten exactamente una tarea `in_progress`.
- Lee DESIGN, SPEC enlazada y evidencia citada antes de descomponer trabajo.
- Busca TASKs cuyo frontmatter enlace exactamente el DESIGN. Si existen, valida que todas sean `type: task`, compartan `id`, `slug`, `spec:` y `design:`, no tengan placeholders, declaren el mismo `task_count` y formen la secuencia completa `01..task_count` sin duplicados.
- Si el conjunto existente es valido, no lo recrees ni sobrescribas: devuelve todas sus rutas y estados en orden. Si es parcial o inconsistente, deten el comando y reporta el problema sin modificar archivos.
- Divide el diseno en el menor numero de slices verticales que puedan implementarse y verificarse de forma independiente; no crees una TASK por capa tecnica.
- Para cada TASK, hereda `id` y `slug`, copia `source_prompt` original desde SPEC, enlaza `spec:` y `design:` con rutas completas, asigna `task_number` de dos digitos empezando por `01` y escribe el total comun `task_count`.
- Crea `.harness/tasks/yyyy-MM-dd/<id>-<slug>-task-<task_number>.md` con fecha UTC y usa `.harness/templates/task.md` como plantilla literal, manteniendo frontmatter, headings y orden.
- Escribe `created_at` en UTC ISO 8601 y `status: ready`; no dejes placeholders sin resolver.
- Incluye criterios `CA-*` aplicables y tareas `TI-01`, `TI-02`, etc. con alcance concreto, evidencia, validacion, tests, cobertura minima `>= 80%` sobre codigo nuevo o modificado cuando sea medible y documentacion aplicable.
- Usa `Ninguno` o `No aplica` para secciones sin contenido; no omitas riesgos ni restricciones del DESIGN.
- Actualiza `todowrite` en tiempo real y valida que cada TASK sea implementable sin decisiones materiales pendientes.

## Restricciones

- No reabras requisitos funcionales ni arquitectura.
- No edites fuera de `.harness/tasks/`, no sobrescribas TASKs existentes y no generes codigo de producto.

## Artefacto

- TASK con `type: task` y estado `ready`.

## Salida

- La primera linea debe ser exactamente `DESIGN_PATH: <ruta>`.
- Desde la segunda linea publica una linea `TASK_PATH: <ruta>` por cada TASK, en orden de `task_number`.
- Despues usa solo bullets breves con slices, validacion y riesgos; no anadas texto antes de las rutas canonicas.
