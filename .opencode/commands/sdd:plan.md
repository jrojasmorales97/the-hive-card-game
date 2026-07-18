---
description: Refina una solicitud en un plan SDD listo para implementar.
agent: sdd-plan
---

Usa `$ARGUMENTS` como peticion natural inicial.

Tu trabajo es crear un `plan` listo para implementarse sin ampliar alcance por tu cuenta.

Reglas:
- empieza usando `todowrite` con tareas breves para explorar el codigo necesario, cerrar gaps por topic y escribir el plan
- acepta solo una peticion natural como entrada principal
- lee `AGENTS.md`, `.harness/context/domain.md` y `.harness/context/architecture.md` antes de planificar
- si falta ese contexto, pide ejecutar `/sdd:init` antes de continuar
- explora el codigo, configuracion, tests y docs necesarios antes de proponer cambios
- si el alcance tecnico es amplio, usa `task` o el agente `explore` para explorar sin crecer demasiado en contexto
- si falta `.harness/templates/plan.md`, deten el comando y explica que el proyecto necesita reinstalar el harness local
- si faltan decisiones materiales para implementar bien, pregunta antes de crear el archivo
- cuando necesites preguntar, agrupa las preguntas por topic y usa `question` en lotes pequenos de un unico tema
- no crees borradores: si el plan se escribe, nace en `status: ready`
- solo crea el artefacto en `.harness/plans/yyyy-MM-dd/<id>-<slug>.md`
- usa `.harness/templates/plan.md` como plantilla literal
- `id` es secuencial diario por tipo: `0.1`, `0.2`, `0.3`, etc.
- deriva `slug` a partir de `# Solicitud refinada`, en minusculas, sin acentos y con `-`
- rellena `source_prompt` con el texto original del usuario
- usa `created_by_command: /sdd:plan`
- escribe `created_at` en UTC ISO 8601
- si el plan nace de una review, anade `origin_review:` con la ruta completa
- manten el frontmatter, headings y subsecciones exactas de la plantilla
- `## Estado actual` debe citar evidencia concreta del codigo
- `# Criterios de aceptacion` usa bloques `CA-01`, `CA-02`, etc. con `DADO`, `CUANDO`, `ENTONCES` y `Validacion`
- `# Tareas de implementacion` usa slicing vertical con bloques `TI-01`, `TI-02`, etc. e incluye cobertura objetivo `>= 80%` y actualizacion documental
- `# Decisiones tomadas` usa bloques `D-01`, `D-02`, etc. con `Pregunta`, `Decision`, `Motivo` e `Impacto`
- usa `Ninguno` o `No aplica` cuando corresponda
- actualiza `todowrite` en tiempo real mientras cierras gaps y escribes el plan

Antes de cerrar:
- el mensaje final debe empezar exactamente con `ARTEFACT_PATH: <ruta>`
- en la segunda linea indica `ARTEFACT_TYPE: plan`
- despues usa solo bullets breves para exploracion, criterios, slices y decisiones clave
