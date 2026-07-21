---
description: Propone un diseno tecnico SDD desde una SPEC aprobada.
agent: sdd-design
---

## Proposito

Crear un DESIGN tecnico propuesto y trazable a una SPEC aprobada.

## Entrada

Usa `$ARGUMENTS` solo para resolver una SPEC. Acepta una ruta completa o basename exacto; sin argumento, usa la ultima SPEC citada en el hilo.

## Precondiciones

- Si el basename es ambiguo, la ruta no existe o no puedes resolver una SPEC, deten el comando y pide precision.
- La entrada debe tener `type: spec` y `status: approved`; cualquier otro tipo o estado bloquea DESIGN.
- Deben existir `AGENTS.md`, los dos documentos de contexto y `.harness/templates/design.md`; si faltan, pide init o reinstalacion segun corresponda.

## Flujo

- Empieza con `todowrite`: contexto, resolucion de SPEC, exploracion tecnica, gaps, propuesta, gate y cierre; manten exactamente una tarea `in_progress`.
- Lee la SPEC completa, contexto, codigo, configuracion, tests y documentacion relevante; cita rutas y simbolos en el estado actual.
- Usa busquedas enfocadas y `task` o `explore` si una zona es amplia.
- Formula solo preguntas que cierren gaps tecnicos o arquitectonicos materiales, mediante `question`, en lotes pequenos de un unico tema.
- No superes diez preguntas de descubrimiento por ejecucion; la pregunta final de aprobacion no cuenta en ese limite.
- Busca DESIGNs cuyo frontmatter enlace exactamente la SPEC. Si hay mas de uno, deten el comando y reporta la ambiguedad sin modificar ninguno. Si hay uno `approved`, no crees otro: deten la escritura y devuelve su ruta. Si hay uno `proposed`, reanudalo sin sobrescribirlo desde cero.
- Para un DESIGN nuevo, hereda `id` y `slug`, copia `source_prompt` original desde SPEC, enlaza `spec:` con su ruta completa y crea `.harness/designs/yyyy-MM-dd/<id>-<slug>.md` con fecha UTC.
- Usa `.harness/templates/design.md` como plantilla literal, manteniendo frontmatter, headings y orden; escribe `created_at` en UTC ISO 8601 y `status: proposed`; no dejes placeholders.
- En `# Evidencia y estado actual`, cita evidencia concreta. Registra decisiones `D-01`, `D-02`, etc. dentro de la propuesta con `Pregunta`, `Decision`, `Motivo` e `Impacto`.
- Incluye impacto por capas, riesgos, estrategia de testing con cobertura `>= 80%` cuando sea medible y estrategia documental; usa `Ninguno` o `No aplica` cuando corresponda.
- Tras mostrar un resumen, usa `question` para pedir exactamente `Aprobar` o `Solicitar cambios`.
- Si solicita cambios, pide feedback concreto, actualiza el mismo DESIGN `proposed`, registra la decision humana y repite el gate sin crear otro artefacto.
- Si el usuario decide detener la iteracion, deja el DESIGN `proposed` y cierra con `DECISION: Solicitar cambios`.
- Si aprueba, actualiza solo `status: approved`, `approved_at` en UTC ISO 8601, `approved_by: user` y la decision humana.
- Actualiza `todowrite` en tiempo real y no cierres con tareas pendientes.

## Restricciones

- No genera TASK ni modifica la SPEC.
- No reabras requisitos funcionales, no edites fuera de `.harness/designs/` y no sobrescribas un DESIGN aprobado.

## Artefacto

- DESIGN con `type: design` y estado `proposed` o `approved`.

## Salida

- La primera linea debe ser exactamente `SPEC_PATH: <ruta>`.
- La segunda linea debe ser exactamente `DESIGN_PATH: <ruta>`.
- La tercera linea debe ser exactamente `DECISION: <Aprobar|Solicitar cambios>`.
- Despues usa solo bullets breves con exploracion, decisiones, riesgos y estado; no anadas texto antes de esas lineas.
