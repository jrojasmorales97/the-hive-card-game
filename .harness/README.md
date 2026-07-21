# Harness SDD

Esta carpeta guarda los artefactos del flujo SDD del proyecto.

## Flujo

`init -> spec -> gate -> design -> gate -> task -> implement`

`/sdd:plan` orquesta SPEC, DESIGN y TASK; no crea un plan monolitico implementable.

## Comandos

- `/sdd:spec` crea una SPEC `proposed`, pregunta como maximo diez veces y requiere `Aprobar|Solicitar cambios`.
- `/sdd:design` consume SPEC `approved`, crea DESIGN `proposed` y requiere el mismo gate.
- `/sdd:task` consume DESIGN `approved` y crea una o varias TASK `ready`.
- `/sdd:implement` ejecuta una TASK y la actualiza a `implemented` al completar.

## Estructura y estados

- `specs/`: SPEC `proposed|approved`.
- `designs/`: DESIGN `proposed|approved`, con `spec:`.
- `tasks/`: TASK `ready|implemented`, con `spec:` y `design:`.
- `implementations/`: reportes con `task:`.
- `reviews/`: reviews historicas preservadas; no es una fase operativa.
- `plans/`: artefactos monoliticos historicos preservados, no operativos.
- `templates/`: contratos literales; `context/`: snapshots regenerados por `/sdd:init`.

SPEC genera un short GUID hexadecimal de ocho caracteres, comprobado contra colisiones. DESIGN, TASK e implementation heredan ese `id`; las TASK se numeran `-task-01`, `-task-02`.

Los artefactos no se sobrescriben: DESIGN reanuda una propuesta existente y TASK valida `task_count` antes de devolver las rutas ya creadas para un DESIGN. Los contratos de metadata, plantillas literales y primeras lineas de salida son obligatorios para la orquestacion.

## Convencion de salida

- `SPEC_PATH: <ruta>`
- `DESIGN_PATH: <ruta>`
- `TASK_PATH: <ruta>`
- `ARTEFACT_PATH: <ruta>`
- `DECISION: <Aprobar|Solicitar cambios>`

## Contexto regenerado

- `../AGENTS.md`: indice de referencias, artefactos y skills.
- `context/domain.md`: proposito, contexto funcional y glosario.
- `context/architecture.md`: stack, capas, convenciones y comandos.
