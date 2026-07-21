---
description: Orquesta SPEC, DESIGN y TASK con gates de aprobacion humana.
agent: sdd-plan
---

## Proposito

Convertir una peticion natural en la cadena aprobada `spec -> design -> task`, sin ampliar alcance.

## Entrada

Usa `$ARGUMENTS` como peticion natural inicial.

## Precondiciones

- Deben existir contexto SDD y las plantillas SPEC, DESIGN y TASK.
- Si falta contexto, pide ejecutar `/sdd:init`; si faltan plantillas, pide reinstalar el harness.

## Flujo

- Empieza con `todowrite`: contexto, SPEC, gate SPEC, DESIGN, gate DESIGN, TASK y cierre.
- Lee `AGENTS.md`, `.harness/context/domain.md` y `.harness/context/architecture.md` antes de delegar.
- Delega SPEC al agente `sdd-spec` con la peticion original e instruyele seguir `.opencode/commands/sdd:spec.md` como contrato operativo completo.
- Exige que el resultado de SPEC empiece por `SPEC_PATH` y `DECISION`; verifica que la ruta exista, sea `type: spec` y termine `approved`.
- Continua solo si SPEC termina `approved`; no repitas su gate en el orquestador.
- Delega DESIGN al agente `sdd-design` con `SPEC_PATH` e instruyele seguir `.opencode/commands/sdd:design.md` como contrato operativo completo.
- Exige que el resultado de DESIGN empiece por `SPEC_PATH`, `DESIGN_PATH` y `DECISION`; verifica que la ruta exista, sea `type: design` y termine `approved`.
- Continua solo si DESIGN termina `approved`; no repitas su gate en el orquestador.
- Delega TASK al agente `sdd-task` con `DESIGN_PATH` e instruyele seguir `.opencode/commands/sdd:task.md` como contrato operativo completo.
- Verifica que cada ruta devuelta exista, sea `type: task`, enlace el DESIGN y nazca `ready`.
- Si se rechaza o bloquea una fase, no ejecutes la siguiente.
- Actualiza `todowrite` en tiempo real y deja reflejado el resultado de cada fase.

## Restricciones

- No crees ni aceptes artefactos `plan` monoliticos nuevos.
- No invoques slash commands: usa `task` solo con `sdd-spec`, `sdd-design` y `sdd-task`.
- No implementes codigo, no edites artefactos y no inventes decisiones ausentes de los artefactos delegados.

## Artefactos

- `.harness/specs/yyyy-MM-dd/<id>-<slug>.md`
- `.harness/designs/yyyy-MM-dd/<id>-<slug>.md`
- `.harness/tasks/yyyy-MM-dd/<id>-<slug>-task-01.md`

## Salida

### Cadena completada

- La primera linea debe ser exactamente `SPEC_PATH: <ruta>`.
- La segunda linea debe ser exactamente `DESIGN_PATH: <ruta>`.
- Desde la tercera linea publica una linea `TASK_PATH: <ruta>` por cada TASK, en orden de `task_number`.

### Cadena detenida

- Si se detiene despues de SPEC, publica solo `SPEC_PATH: <ruta>` y `DECISION: Solicitar cambios` como primeras lineas.
- Si se detiene despues de DESIGN, publica `SPEC_PATH: <ruta>`, `DESIGN_PATH: <ruta>` y `DECISION: Solicitar cambios` como primeras lineas.
- Despues usa solo bullets breves con decisiones y bloqueos; no anadas texto antes de las rutas canonicas aplicables.
