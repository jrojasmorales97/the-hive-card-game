---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: implementation
created_at: 2026-07-21T22:20:59Z
created_by_command: /sdd:implement
source_prompt: |-
  Implementa exclusivamente esta TASK SDD siguiendo `.opencode/commands/sdd:implement.md` como contrato operativo completo:

  .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-01.md

  Es la primera ola de una cadena estricta 01→02→03→04→05. Trabaja sobre el workspace compartido, captura baseline y cambios preexistentes antes de editar, respeta TASK/DESIGN/SPEC/contexto, implementa todos los `TI-*`, ejecuta sus validaciones, crea el reporte `.harness/implementations/...task-01.md` al final y cambia únicamente el status de esta TASK a `implemented` si queda `completed`. No implementes alcance de TASK 02-05, no modifiques otros artefactos previos, no reviertas cambios ajenos y no hagas commit. Tu salida debe respetar exactamente el formato canónico `ARTEFACT_PATH`, `ARTEFACT_TYPE`, `TASK_PATH` y bullets breves.
status: blocked
task: .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-01.md
baseline: 1e747b26f985e3f17c2ff74909c3e43211ba907e
---

# Resumen de ejecucion

Implementación parcial verificada de TI-01 a TI-04 y parte de TI-02/TI-03/TI-07. El artefacto queda bloqueado porque TI-05 y TI-06 no han migrado los handlers Socket.IO de sala al nuevo caso de uso; por ello la TASK permanece `ready`.

# Alcance del cambio

Base: `1e747b26f985e3f17c2ff74909c3e43211ba907e`

Archivos modificados:

- Modificados: `.harness/context/architecture.md`, `.harness/context/domain.md`, `apps/backend/package.json`, `apps/backend/src/domain/{cards,progression,round,setup,star}.ts`, `apps/backend/src/domainBoundaries.ts`, `apps/backend/src/domainCoverageReporter.mjs`, `apps/backend/src/index.ts`, `apps/backend/src/privateState.ts`.
- Movidos: `gameStateMachine.{ts,test.ts}` a `domain/stateMachine.{ts,test.ts}`; `lobbyRules.{ts,test.ts}` a `domain/room.{ts,test.ts}`; `domainAdapter.{ts,test.ts}` a `application/domainAdapter.{ts,test.ts}`.
- Añadidos: `application/{model,result,dispatcher,playerView,roomUseCases}.{ts,test.ts}`, los cinco puertos en `application/ports/`, `infrastructure/{memory/inMemoryRoomRepository,runtime/systemClock,runtime/systemRandomSource,scheduling/processScheduler}.ts`, `tooling/{testFiles,layerBoundaries}.{ts,test.ts}` y `transport/socket/sessionRegistry.{ts,test.ts}`.
- Eliminados: solamente las rutas origen de los tres movimientos anteriores; no hay reexports transitorios.

Cambios preexistentes:

- Estado inicial no rastreado, preservado sin editar: `.harness/designs/2026-07-21/`, `.harness/specs/2026-07-21/`, las TASK `01` a `05` bajo `.harness/tasks/2026-07-21/`.
- `git diff --binary` y `git diff --cached --binary` iniciales: vacíos.

# TASK ejecutada

- TI-01: completada; inventario recursivo estable y checker AST de capas, scripts compartidos y tests negativos.
- TI-02: completada; máquina y reglas de sala movidas bajo `domain/`, imports y tests actualizados.
- TI-03: completada en la API nueva; modelos, resultado, dispatcher, puertos, adaptador y proyección sin wire creados.
- TI-04: completada; repositorio en memoria, runtime, scheduler de proceso y fakes deterministas embebidos en tests.
- TI-05: pendiente; `index.ts` todavía conserva las mutaciones y handlers de sala originales, por lo que no delega en `roomUseCases.ts`.
- TI-06: pendiente; existe `SessionRegistry` probado, pero no está conectado a los handlers/presenters/publisher de Socket.IO.
- TI-07: parcial; pruebas unitarias, integración Socket.IO existente, checker, inventario, búsqueda y cobertura ejecutados; falta la auditoría de propietario único de handlers migrados.

# Cambios realizados

- Se impuso `application -> domain` y se prohibieron en aplicación Socket.IO, Fastify, contracts wire, Node, transport e infraestructura.
- Se creó `ApplicationResult` discriminado y casos de uso sin sockets para crear/unir/reconectar/salir/expulsar/resync/desconectar, con commit previo a publicación y repositorio versionado.
- Se trasladó la máquina autoritativa y las reglas de lobby sin ruta de compatibilidad.
- Se preservó el contrato Socket.IO existente; las regresiones pasan porque no se activó aún la sustitución de handlers.

# Tests y cobertura

- `docker compose run --build --rm --no-deps backend npm test`: 74/74 tests correctos.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`: gate lógico correcto; líneas 93.84%, branches 83.89%, funciones 98.06% en 12 archivos medibles de `domain/` y `application/`.
- Tests nuevos cubren inventario recursivo, checker y categorías prohibidas, casos de uso de sala, índices/versionado, dispatcher indirecto, sesión stale y migración canónica.

# Documentacion actualizada

- `architecture.md`: capas creadas, aliases/checker, inventario, dispatcher y primera familia de sala.
- `domain.md`: ruta canónica, responsabilidad de `domain/room.ts` y orquestación socket-free de sala.
- `AGENTS.md`: No aplica; la TASK prohíbe actualizarlo hasta TASK 05.

# Comandos de validacion ejecutados

- `git rev-parse HEAD`; `git status --short`; `git diff --binary`; `git diff --cached --binary`.
- `npm test` y `npx tsc --noEmit -p tsconfig.json` desde `apps/backend`.
- `docker compose run --build --rm --no-deps backend npm test`.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`.
- `docker compose run --build --rm --no-deps backend npm run build`.
- `git diff --check`; búsquedas de rutas retiradas y de imports prohibidos.

# Bloqueos o desviaciones

- Bloqueo material: la TASK exige retirar los handlers, Maps y mutaciones de sala de `index.ts` en el mismo slice. La implementación nueva no está conectada a transporte y hacerlo ahora requiere completar TI-05/TI-06 sin dejar doble propietario; no se puede declarar finalizada sin esa migración.
- Desviación controlada: el build local no pudo escribir `dist/` por permisos (`EACCES`); la validación canónica Docker de build sí completó correctamente.
- La TASK no cambió de `ready` a `implemented` por el bloqueo.
