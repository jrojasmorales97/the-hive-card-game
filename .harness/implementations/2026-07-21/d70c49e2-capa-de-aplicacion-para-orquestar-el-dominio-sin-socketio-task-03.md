---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: implementation
created_at: 2026-07-21T23:04:57Z
created_by_command: /sdd:implement
source_prompt: |-
  Implementa exclusivamente esta TASK SDD siguiendo `.opencode/commands/sdd:implement.md` como contrato operativo completo:

  .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-03.md

  TASK 01 y TASK 02 están validadas como `implemented`; parte del estado actual compartido. Tercera ola de la cadena 01→02→03→04→05. Captura baseline/diffs preexistentes, completa todos los `TI-*` de ready, pausa y expiraciones de ronda sobre la base existente, preserva contratos y propietario único, ejecuta tests, coverage y build, crea el reporte y cambia únicamente TASK 03 a `implemented` si todo pasa. No implementes juego/progresión/CPU ni estrella de TASK 04-05, no modifiques artefactos previos salvo el status permitido de esta TASK, no reviertas cambios ajenos y no hagas commit. Devuelve formato canónico.
status: completed
task: .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-03.md
baseline: 1e747b26f985e3f17c2ff74909c3e43211ba907e
---

# Resumen de ejecucion

Se migraron ready, pausa manual y la expiración de countdown a la capa de aplicación, sin sockets ni timers reales en los casos de uso. La suite backend, cobertura y build finalizaron correctamente.

# Alcance del cambio

Base: `1e747b26f985e3f17c2ff74909c3e43211ba907e`

Archivos modificados:

- Modificados: `.harness/context/architecture.md`, `.harness/context/domain.md`, `apps/backend/src/application/effectUseCases.test.ts`, `apps/backend/src/application/gameUseCases.test.ts`, `apps/backend/src/application/gameUseCases.ts`, `apps/backend/src/application/playerView.ts`, `apps/backend/src/application/result.ts`, `apps/backend/src/index.ts`, `apps/backend/src/transport/socket/socketEventPublisher.test.ts`, `apps/backend/src/transport/socket/socketEventPublisher.ts`.
- Añadidos: `apps/backend/src/application/playerView.test.ts`.
- Renombrados/eliminados: Ninguno.

Cambios preexistentes:

- Estado inicial capturado con `git status --short`: modificaciones y eliminaciones de la migración TASK 01--02 en contexto, `package.json`, dominio, `index.ts` y tooling; además de los árboles no rastreados `application/`, `infrastructure/`, `transport/`, `tooling/`, `domain/room*`, `domain/stateMachine*`, SPEC, DESIGN, TASK 01--05 e implementaciones TASK 01--02.
- Snapshot completo capturado antes de editar mediante `git diff --binary` y `git diff --cached --binary`; no había cambios staged. El baseline y esos snapshots no se revirtieron ni se alteraron.

# TASK ejecutada

- TI-01: caracterizadas las matrices de ready/quorum/CPU/población y pausa manual frente a automática mediante pruebas unitarias e integración Socket.IO.
- TI-02: implementados `GameUseCases.setPlayerReady` y `requestPause`; guardan con versión esperada, despachan una sola vez y dejan decisiones en `domain/round.ts`.
- TI-03: `EffectUseCases.materialize` cubre dealing y countdown usando el efecto original, versión y expectativas stale; el scheduler reemplaza por `{ roomCode, trigger }`.
- TI-04: migrados `player:ready` y `game:pause-request` a adaptadores wire/ack; retirados del handler acceso directo a dominio, timer de countdown, publicación y traducción de pausa.
- TI-05: `playerCapabilities` deriva ready/pause de `commandDecision` con reloj inyectado; se probaron host/invitado, foco, playing, locks y mano vacía.
- TI-06: auditoría estática confirma que las llamadas a ready/pausa/expiración viven solo en dominio, `gameUseCases` o `effectUseCases`; `game:paused` solo se publica desde el publisher de la pausa manual.

# Cambios realizados

- `GameUseCases` incorpora comandos socket-free para ready y pausa, una duración de countdown inyectada dinámicamente y resultados con cambios, eventos y efectos completos.
- El publisher traduce `game-paused` en el orden snapshot, evento, log, conservando el payload tipado `{ version, by }` del contrato.
- El callback de countdown vuelve por `EffectUseCases`; callbacks antes de deadline, repetidos, con versión divergente, retry, lock reemplazado o sala borrada no escriben ni publican.
- `index.ts` conserva las familias de TASK 04--05, pero sus handlers de ready/pausa delegan exclusivamente en aplicación.

# Tests y cobertura

- `apps/backend/src/application/gameUseCases.test.ts`: ready, quorum, mano vacía, CPU, pausas, rechazos, inmutabilidad, eventos y scheduler fake.
- `apps/backend/src/application/effectUseCases.test.ts`: countdown antes/en/después de deadline y ejecución única stale-safe.
- `apps/backend/src/application/playerView.test.ts` y `transport/socket/socketEventPublisher.test.ts`: capacidades privadas inyectadas y orden/payload de pausa.
- Cobertura lógica medible: líneas `95.04%`, branches `83.97%`, funciones `97.27%` (umbral `>=80%`).

# Documentacion actualizada

- `.harness/context/domain.md`: responsables de ready/pausa, poblaciones, CPU, silencio automático y expectativas de countdown.
- `.harness/context/architecture.md`: flujo comando/commit/dispatch y materialización de dealing/countdown por aplicación.
- Contrato público y `AGENTS.md`: No aplica en TASK 03.

# Comandos de validacion ejecutados

- `git rev-parse HEAD` → `1e747b26f985e3f17c2ff74909c3e43211ba907e`.
- `git status --short`; `git diff --binary`; `git diff --cached --binary`; `git diff --check` → sin errores de whitespace.
- `docker compose run --build --rm --no-deps backend npm test` → 85/85 tests correctos.
- `docker compose run --build --rm --no-deps backend npm run test:coverage` → correcto; gate lógico `95.04%`/`83.97%`/`97.27%`.
- `docker compose run --build --rm --no-deps backend npm run build` → correcto.
- Búsquedas estáticas de `setRoundReady`, `pauseRound`, `expireRoundEffect`, `countdown-expired` y `game:paused` → propietario único confirmado.

# Bloqueos o desviaciones

Ninguno. No se modificaron `packages/contracts/`, frontend, juego/progresión/CPU ni estrella; no se creó commit.
