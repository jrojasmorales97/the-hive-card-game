---
description: Regenera el indice de agentes y el contexto funcional y tecnico del proyecto.
agent: sdd-init
subtask: true
---

## Proposito

Regenerar el indice y el contexto SDD desde la evidencia actual del repositorio.

## Entrada

Usa `$ARGUMENTS` solo como contexto adicional; nunca sustituye la evidencia.

## Precondiciones

- Deben existir las plantillas bajo `.harness/templates/`; si faltan, pide ejecutar `sdd-bootstrap install`.

## Flujo

- Usa `todowrite` para cubrir inventario, dominio, arquitectura, skills y escritura.
- Inspecciona manifests, configuracion, entrypoints, estructura, tests, documentacion y artefactos SDD.
- Usa busquedas enfocadas y subagentes `explore` cuando una zona sea amplia.
- Inspecciona skills locales en `.opencode/skills/`, `.agents/skills/` y `.claude/skills/`.
- Usa SPEC, DESIGN, TASK, implementations y reviews existentes como fuentes cronologicas del log de requerimientos cuando existan.
- Documenta solo dependencias directas declaradas; no enumeres dependencias transitivas.
- Regenera `AGENTS.md`, `.harness/context/domain.md` y `.harness/context/architecture.md` como snapshots completos y coherentes.
- Usa `.harness/templates/agents.md`, `domain.md` y `architecture.md` como contratos literales para sus respectivos documentos.
- Rellena las tablas canonicas de skills, requerimientos, glosario y paquetes con una fila por elemento y una ruta de evidencia.
- Manten `AGENTS.md` como indice corto de contexto, artefactos y skills; no dupliques dominio ni arquitectura.
- Cita rutas, simbolos, manifests o scripts en las afirmaciones importantes.
- No inventes hechos; declara ausencias e incertidumbres con `Ninguno`, `No aplica` o `Desconocido`.

## Restricciones

- No modifiques codigo de producto ni otros archivos.

## Artefactos

- `AGENTS.md`
- `.harness/context/domain.md`
- `.harness/context/architecture.md`

## Salida

- La primera linea debe ser exactamente `CONTEXT_PATH: AGENTS.md`.
- La segunda linea debe ser exactamente `DOMAIN_PATH: .harness/context/domain.md`.
- La tercera linea debe ser exactamente `ARCHITECTURE_PATH: .harness/context/architecture.md`.
- Despues usa solo bullets breves con fuentes cubiertas e incertidumbres principales; no anadas texto antes de las tres rutas.
