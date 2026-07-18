# Harness SDD

Esta carpeta guarda los artefactos del flujo SDD del proyecto.

## Comandos

- `/sdd:init`: regenera `AGENTS.md` y el contexto funcional y tecnico del proyecto
- `/sdd:plan`: explora el codigo necesario y genera un plan listo para implementar
- `/sdd:implement`: ejecuta un plan y genera su reporte de implementacion
- `/sdd:review`: muestra y comenta secuencialmente todos los diffs antes de pedir una decision humana

## Flujo

`plan -> implement -> review -> decision humana`

La review no crea trabajo nuevo automaticamente. Si quieres actuar sobre una review, crea un plan nuevo manualmente usando esa review como contexto.

## Estructura

- `templates/`: plantillas literales del harness
- `context/`: contexto funcional y tecnico regenerado por `/sdd:init`
- `plans/`: planes versionados
- `implementations/`: reportes de implementacion versionados
- `reviews/`: reviews versionadas

## Convencion de salida

Los comandos publican en el hilo principal una linea canonica con el artefacto creado:

- `ARTEFACT_PATH: <ruta>`

Y cuando aplique tambien:

- `ARTEFACT_TYPE: <tipo>`
- `PLAN_PATH: <ruta>`
- `IMPLEMENTATION_PATH: <ruta>`
- `DECISION: <Aprobar|Solicitar cambios>`

## Contexto regenerado

- `../AGENTS.md`: indice de referencias, artefactos y uso de skills
- `context/domain.md`: proposito, contexto funcional, requerimientos, funcionalidades y glosario
- `context/architecture.md`: stack, capas, estrategia de carpetas, convenciones, patrones, dependencias y comandos
