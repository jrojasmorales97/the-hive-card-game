---
description: Propone una especificacion funcional SDD con gate humano.
agent: sdd-spec
---

## Proposito

Crear una SPEC funcional propuesta desde una peticion natural.

## Entrada

Usa `$ARGUMENTS` solo como peticion natural inicial.

## Precondiciones

- Deben existir `AGENTS.md`, `.harness/context/domain.md`, `.harness/context/architecture.md` y `.harness/templates/spec.md`.
- Si falta contexto, pide ejecutar `/sdd:init`; si falta la plantilla, pide reinstalar el harness y deten el comando.

## Flujo

- Empieza con `todowrite`: contexto, exploracion funcional, gaps, propuesta, gate y cierre; manten exactamente una tarea `in_progress`.
- Lee el contexto y explora codigo, configuracion, tests, documentacion y artefactos necesarios antes de proponer.
- Usa busquedas enfocadas y `task` o `explore` si una zona es amplia.
- Formula solo preguntas que cierren gaps funcionales materiales, mediante `question`, en lotes pequenos de un unico tema.
- No superes diez preguntas de descubrimiento por ejecucion; la pregunta final de aprobacion no cuenta en ese limite.
- No escribas la SPEC hasta cerrar todos los gaps funcionales materiales. No inventes requisitos ni decisiones.
- Genera un short GUID hexadecimal lowercase de ocho caracteres y comprueba que no aparezca como `id` en `specs/`, `designs/`, `tasks/`, `implementations/` ni `reviews/`; regenera ante colision.
- Deriva `slug` de `# Solicitud refinada`, en minusculas, sin acentos y separado con `-`.
- Crea `.harness/specs/yyyy-MM-dd/<id>-<slug>.md` con fecha UTC y usa `.harness/templates/spec.md` como plantilla literal, manteniendo su frontmatter, headings y orden.
- Rellena `source_prompt` con la peticion original completa, `created_at` en UTC ISO 8601 y `status: proposed`; no dejes placeholders sin resolver.
- Escribe criterios `CA-01`, `CA-02`, etc. con `DADO`, `CUANDO`, `ENTONCES` y `Validacion`.
- En `# Gaps resueltos`, registra bloques `GF-01`, `GF-02`, etc. con `Pregunta`, `Decision`, `Motivo` e `Impacto`; usa `Ninguno` cuando no haya gaps.
- Tras mostrar un resumen de la propuesta, usa `question` para pedir exactamente `Aprobar` o `Solicitar cambios`.
- Si solicita cambios, pide feedback concreto, actualiza la misma SPEC `proposed`, registra la decision humana y repite el gate sin crear otro artefacto.
- Si el usuario decide detener la iteracion, deja la SPEC `proposed` y cierra con `DECISION: Solicitar cambios`.
- Si aprueba, actualiza solo `status: approved`, `approved_at` en UTC ISO 8601, `approved_by: user` y la decision humana.
- Actualiza `todowrite` en tiempo real y no cierres con tareas pendientes.

## Restricciones

- No propongas arquitectura ni generes TASK.
- No edites fuera de `.harness/specs/` ni sobrescribas otro artefacto.

## Artefacto

- SPEC con `type: spec` y estado `proposed` o `approved`.

## Salida

- La primera linea debe ser exactamente `SPEC_PATH: <ruta>`.
- La segunda linea debe ser exactamente `DECISION: <Aprobar|Solicitar cambios>`.
- Despues usa solo bullets breves con preguntas realizadas, criterios, gaps y estado; no anadas texto antes de esas lineas.
