---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: implementation
created_at: 2026-07-21T23:21:43Z
created_by_command: /sdd:implement
source_prompt: |-
  Implementa exclusivamente esta TASK SDD siguiendo `.opencode/commands/sdd:implement.md` como contrato operativo completo:

  .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-04.md

  TASK 01-03 están validadas como `implemented`; parte del estado actual compartido. Cuarta ola de la cadena 01→02→03→04→05. Captura baseline/diffs, completa todos los `TI-*` de jugar, callbacks de cartas, progresión, terminales y CPU sin duplicar reglas, preserva contratos y propietario único, ejecuta tests, coverage y build, crea el reporte y cambia únicamente TASK 04 a `implemented` si todo pasa. No migres comandos/settlement de estrella ni cierre documental de TASK 05, no modifiques artefactos previos salvo el status permitido, no reviertas cambios ajenos y no hagas commit. Devuelve formato canónico.
status: completed
task: /home/jromo/Projects/the-hive-card-game/.harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-04.md
baseline: 1e747b26f985e3f17c2ff74909c3e43211ba907e
---

# Resumen de ejecucion

Se completaron TI-01 a TI-07: `game:play-card`, sus callbacks de cartas, progresión/terminales y CPU delegan en aplicación con decisiones conservadas en dominio, resultados versionados y scheduler reemplazable. TASK 04 queda implementada; estrella conserva su propietario de comandos y settlement para TASK 05.

# Alcance del cambio

Base: `1e747b26f985e3f17c2ff74909c3e43211ba907e`

Archivos modificados:

- Modificados: `.harness/context/domain.md`, `.harness/context/architecture.md`.
- Modificados: `apps/backend/src/domain/cards.ts`, `apps/backend/src/domain/cards.test.ts`.
- Modificados: `apps/backend/src/application/gameUseCases.ts`, `apps/backend/src/application/effectUseCases.ts`, `apps/backend/src/application/result.ts`, `apps/backend/src/application/gameUseCases.test.ts`, `apps/backend/src/application/effectUseCases.test.ts`.
- Modificados: `apps/backend/src/transport/socket/socketEventPublisher.ts`, `apps/backend/src/index.ts`.
- Modificado al cierre permitido: `.harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-04.md` (`ready` → `implemented`).
- Añadido: este artefacto de implementación.
- Renombrados/eliminados por esta TASK: Ninguno.

Cambios preexistentes:

- Baseline capturada antes de editar con `git rev-parse HEAD` (`1e747b26f985e3f17c2ff74909c3e43211ba907e`), `git status --short`, `git diff --binary` y `git diff --cached --binary`; no había cambios staged.
- El snapshot binario completo de cambios preexistentes fue capturado en la salida de ejecución `/home/jromo/.local/share/opencode/tool-output/tool_f86ee5755001UiGG04PmYA9aVz` (2.464 líneas). Incluía la migración no committeada de TASK 01--03: contexto, scripts, dominio reubicado, `application/`, infraestructura, transporte, tooling y sus TASK/spec/design/implementations previos.
- Estado inicial no staged: `.harness/context/{architecture,domain}.md`; `apps/backend/package.json`; `apps/backend/src/domain/{cards,progression,round,setup,star}.ts`; `apps/backend/src/domainBoundaries.ts`; `apps/backend/src/domainCoverageReporter.mjs`; `apps/backend/src/index.ts`; `apps/backend/src/privateState.ts`; y borrados `domainAdapter*`, `gameStateMachine*`, `lobbyRules*` bajo `apps/backend/src/`.
- Estado inicial untracked: `.harness/{designs,specs,tasks}/2026-07-21`, implementations previas d70c49e2, `apps/backend/src/{application,infrastructure,tooling,transport}/`, y `domain/{room,stateMachine}` con tests. Se preservaron sin revertirlos.

# TASK ejecutada

`/home/jromo/Projects/the-hive-card-game/.harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-04.md` — TI-01 a TI-07 completadas.

# Cambios realizados

- TI-01: se caracterizaron permisos, errores, orden, pausas silenciosas, locks, terminales y CPU mediante regresiones unitarias deterministas y Socket.IO existentes.
- TI-02: `GameUseCases.playCard` invoca únicamente `domain/cards.ts`, persiste una vez, despacha hechos de carta ordenados y programa CPU solo tras continuidad aceptada.
- TI-03: `EffectUseCases` materializa `error-expired`, `round-flip-expired` y `round-unflip-expired` con versión, fase, lock y deadline originales; los stale son no-op.
- TI-04: los callbacks encadenan `completeLevel`, recompensa, avance, release de nivel, derrota/victoria y scoring a través de `domain/progression.ts`/`domain/scoring.ts`, sin recalcular reglas en transporte.
- TI-05: `domain/cards.ts` decide la siguiente carta CPU; `cpu-turn` se reemplaza por `{ roomCode, trigger }`, se agenda tras carta o countdown aceptado y vuelve al mismo flujo de `playCard`.
- TI-06: `game:play-card` conserva parser/ack y delega en `GameUseCases`; se retiraron `playCardWithDomain`, materializadores, Maps/timers y helpers heredados de cartas/progresión/CPU. El puente mínimo de efectos de settlement estrella permanece para TASK 05.
- TI-07: se buscaron símbolos retirados y APIs prohibidas en `application/`; no quedan materializadores/timers de esta familia fuera de aplicación/infraestructura.
- `SocketEventPublisher` materializa los eventos de carta, penalización, descarte, nivel, recompensa, terminal y CPU sin cambiar contracts, versión observable, snapshots, privacidad, logs ni acks.

# Tests y cobertura

- Backend: 91 tests pasan, incluidos jugada válida/error, callbacks antes/en/después de deadline, pausa silenciosa, derrota/scoring, flip/unflip, recompensa/progresión, release, CPU directo y CPU tras countdown, retry, locks, versión y sala borrada.
- Cobertura lógica (`domain` + `application`): líneas 95.48%, branches 84.49%, funciones 97.49%; supera el mínimo >=80% en las tres métricas.
- Frontend sin cambios: 55 tests pasan; cobertura global líneas 93.56%, branches 93.39%, funciones 98.29%.

# Documentacion actualizada

- `.harness/context/domain.md`: propietarios de jugada, callbacks, progresión/terminales y selección CPU.
- `.harness/context/architecture.md`: claves efectivas del scheduler, flujo `GameUseCases`/`EffectUseCases`, y límites de propietario.
- `AGENTS.md`: No aplica; TASK 05 conserva el cierre documental solicitado.
- Contracts públicos: No aplica; no se modificó `packages/contracts/`.

# Comandos de validacion ejecutados

- `git rev-parse HEAD && git status --short && git diff --binary && git diff --cached --binary` — baseline capturada.
- `docker compose run --build --rm --no-deps backend npm test` — pasa, 91/91.
- `docker compose run --build --rm --no-deps backend npm run test:coverage` — pasa, cobertura lógica 95.48% / 84.49% / 97.49%.
- `docker compose run --build --rm --no-deps backend npm run build` — pasa.
- `docker compose run --build --rm --no-deps frontend npm test` — pasa, 55/55.
- `docker compose run --build --rm --no-deps frontend npm run test:coverage` — pasa, 93.56% / 93.39% / 98.29%.
- `docker compose run --build --rm --no-deps frontend npm run build` — pasa.
- `git diff --check` — pasa.
- Búsquedas de propietarios retirados y de `Date.now`/`Math.random`/timers/Socket.IO/Fastify en `application/` — sin coincidencias prohibidas.

# Bloqueos o desviaciones

Ninguno. No se migraron comandos ni settlement de estrella, no se cerró documentación de TASK 05, no se modificaron contratos ni se hizo commit.
