---
description: Regenera el indice de agentes y el contexto funcional y tecnico del proyecto.
agent: sdd-init
subtask: true
---

Usa `$ARGUMENTS` como contexto adicional del usuario, nunca como sustituto de la evidencia del repositorio.

Tu trabajo es regenerar completamente estos archivos:
- `AGENTS.md`
- `.harness/context/domain.md`
- `.harness/context/architecture.md`

Reglas:
- empieza usando `todowrite` para cubrir inventario, dominio, arquitectura, skills y escritura final
- si falta alguna plantilla bajo `.harness/templates/`, deten el comando y pide ejecutar `sdd-bootstrap install`
- inspecciona primero manifests, configuracion, entrypoints, estructura, tests, documentacion y artefactos SDD
- usa busquedas enfocadas y subagentes `explore` cuando una zona sea amplia
- sobrescribe los tres documentos como snapshots completos y coherentes del estado actual
- no modifiques codigo de producto ni otros archivos
- no inventes negocio, arquitectura, comandos o skills sin evidencia
- marca ausencias e incertidumbres de forma explicita
- cita rutas, simbolos, manifests o scripts en las afirmaciones importantes
- usa `.harness/templates/agents.md` como contrato para `AGENTS.md`
- usa `.harness/templates/domain.md` como contrato para `.harness/context/domain.md`
- usa `.harness/templates/architecture.md` como contrato para `.harness/context/architecture.md`
- para el log de requerimientos, usa planes y reviews existentes como fuentes cronologicas cuando existan
- para paquetes instalados, documenta dependencias directas declaradas; no enumeres dependencias transitivas
- para skills, inspecciona skills locales del proyecto en `.opencode/skills/`, `.agents/skills/` y `.claude/skills/`
- rellena las tablas canonicas de skills, requerimientos, glosario y paquetes con una fila por elemento y rutas de evidencia
- `AGENTS.md` debe ser un indice corto: referencia contexto, artefactos y cada skill con una regla clara de uso, sin duplicar los otros documentos
- escribe `Ninguno`, `No aplica` o `Desconocido` cuando corresponda

Antes de cerrar:
- la primera linea debe ser exactamente `CONTEXT_PATH: AGENTS.md`
- la segunda linea debe ser exactamente `DOMAIN_PATH: .harness/context/domain.md`
- la tercera linea debe ser exactamente `ARCHITECTURE_PATH: .harness/context/architecture.md`
- despues usa solo bullets breves con fuentes cubiertas e incertidumbres principales
