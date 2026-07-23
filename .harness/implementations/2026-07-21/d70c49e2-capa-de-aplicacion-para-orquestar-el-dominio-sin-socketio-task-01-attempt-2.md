---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: implementation
created_at: 2026-07-21T22:25:25Z
created_by_command: /sdd:implement
source_prompt: |-
  Reanuda TASK 01. El intento anterior quedó `blocked` porque los handlers Socket.IO de sala aún no delegan en `roomUseCases`, lo que incumple TI-05/TI-06 y CA-09. La TASK sigue `ready`. Sigue nuevamente `.opencode/commands/sdd:implement.md`: captura el nuevo baseline/estado/diffs, completa exclusivamente el alcance pendiente de TASK 01, conecta create/join/reconnect/leave/kick/resync/disconnect mediante aplicación y separa sesión/presentación según el DESIGN, retira los caminos activos anteriores, añade/ajusta tests, ejecuta toda la validación exigida y crea un reporte `-attempt-2` sin sobrescribir el anterior. Solo marca TASK 01 `implemented` si todos los TI y gates pasan. No avances TASK 02-05, no hagas commit ni reviertas cambios ajenos. Devuelve el formato canónico.
status: blocked
task: .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-01.md
baseline: 1e747b26f985e3f17c2ff74909c3e43211ba907e
---

# Resumen de ejecucion

Se conectaron create, join/reconnect, leave, resync, kick y disconnect a `RoomUseCases`, y se activó `SessionRegistry` para impedir desconexiones stale. El resultado permanece bloqueado: no se extrajeron presenters ni publisher Socket.IO, y `index.ts` conserva serialización/emisión de sala, incumpliendo TI-06 y el objetivo de composition root.

# Alcance del cambio

Base: `1e747b26f985e3f17c2ff74909c3e43211ba907e`

Archivos modificados:

- Modificado en esta reanudación: `apps/backend/src/index.ts` y `apps/backend/src/transport/socket/sessionRegistry.ts`.
- Cambios preexistentes preservados: todos los cambios no rastreados y modificados del intento 1, incluidos contextos, TASKs, SPEC, DESIGN, implementación previa y nuevas rutas backend.

Cambios preexistentes:

- `git diff --binary` inicial contenía íntegramente el intento 1 no confirmado; `git diff --cached --binary` estaba vacío.
- No se revirtió ni sobrescribió ningún artefacto previo.

# TASK ejecutada

- TI-05: parcialmente completada; handlers de create/join/reconnect/leave/kick/resync/disconnect invocan `RoomUseCases` y sus mutaciones de presencia pasan por el repositorio inyectado.
- TI-06: parcialmente completada; `SessionRegistry` activo reemplaza `socketPlayer` y protege disconnect stale, pero faltan `roomPresenter.ts`, `socketEventPublisher.ts` y `registerSocketHandlers.ts` separados.
- TI-07: validaciones correctas, pero no puede cerrar mientras TI-06 siga pendiente.

# Cambios realizados

- El composition root inyecta un adaptador de repositorio sobre el estado en memoria existente y conserva una única sesión activa por jugador.
- Los handlers de sala traducen `ApplicationResult` a los acks previos y conservan snapshots, hand privado y textos observables.
- Los broadcasts posteriores a commits de aplicación no incrementan una segunda vez la versión funcional.

# Tests y cobertura

- `docker compose run --build --rm --no-deps backend npm test`: 74/74 correctos.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`: líneas 95.01%, branches 83.61%, funciones 99.36% en el límite lógico; gate >=80% correcto.

# Documentacion actualizada

- No aplica en esta reanudación; se preservó la documentación actualizada durante el intento 1.

# Comandos de validacion ejecutados

- `git rev-parse HEAD`; `git status --short`; `git diff --binary`; `git diff --cached --binary`.
- `npx tsc --noEmit -p tsconfig.json` desde `apps/backend`.
- `docker compose run --build --rm --no-deps backend npm test`.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`.
- `docker compose run --build --rm --no-deps backend npm run build`.
- `git diff --check`.

# Bloqueos o desviaciones

- Bloqueo: completar TI-06 exige extraer presenters, publisher y registro de handlers, retirar serialización y emisiones de `index.ts`, y añadir sus regresiones. No se puede marcar la TASK `implemented` sin ello.
- La TASK queda `ready`; no se editaron TASK 02--05 ni se hizo commit.
