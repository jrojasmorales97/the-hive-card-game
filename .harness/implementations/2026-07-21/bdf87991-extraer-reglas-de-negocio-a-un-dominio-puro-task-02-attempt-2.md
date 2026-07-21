---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: implementation
created_at: 2026-07-21T18:27:00Z
created_by_command: /sdd:implement
source_prompt: >-
  Reanuda y completa la TASK `.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-02.md` usando el artefacto previo `.harness/implementations/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-02.md` como evidencia. El intento anterior terminó incorrectamente `blocked`: aclaración vinculante, `.harness/context/domain.md` y `.harness/context/architecture.md` son documentación de proyecto exigida explícitamente por la sección `# Documentacion aplicable` de la TASK y DEBEN actualizarse si corresponde; no son artefactos SDD previos prohibidos. No reabrir requisitos ni arquitectura y no modificar SPEC/DESIGN/otros TASKs/implementation anterior. Antes de modificar, toma baseline y preserva cambios preexistentes. Verifica que las invariantes reflejen exactamente el código ya implementado para setup/ronda, sin inventar reglas. Ejecuta las validaciones proporcionales necesarias, en particular checker de domain, tests/cobertura/build relevantes. Genera una nueva implementation con sufijo `-attempt-2` conforme `.harness/templates/implementation.md`; debe registrar baseline, estado inicial, snapshots completos de cambios ajenos, archivos tocados, resultados TI, pruebas, cobertura y documentación. Si las TI y validaciones quedan satisfechas, marca implementation `completed` y actualiza exclusivamente el frontmatter de esta TASK a `status: implemented`; si hay un bloqueo técnico real documentado, permanece ready. Devuélveme exactamente las tres líneas de salida requeridas para sdd:implement más bullets concisos.
status: completed
task: /home/jromo/Projects/the-hive-card-game/.harness/tasks/2026-07-21/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro-task-02.md
baseline: f35484c79e4cf6f1756b8994f2e4bd3da878d85f
---

# Resumen de ejecucion

Se reanudo el slice ya implementado y validado por el intento previo. Se actualizaron los dos documentos de contexto exigidos para reflejar, sin ampliar reglas, que `setup.ts` y `round.ts` son propietarios activos. Las invariantes documentadas se contrastaron contra código y pruebas deterministas; no existe bloqueo técnico. La TASK queda implementada.

# Alcance del cambio

Base: `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`

Archivos modificados:

- Añadidos por el slice ya implementado: `apps/backend/src/domain/setup.ts`, `apps/backend/src/domain/setup.test.ts`, `apps/backend/src/domain/round.ts` y `apps/backend/src/domain/round.test.ts`.
- Modificados por el slice ya implementado: `apps/backend/package.json`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/index.ts` y `apps/backend/src/privateState.test.ts`.
- Eliminados por el slice ya implementado: `apps/backend/src/roundParticipants.ts` y `apps/backend/src/roundParticipants.test.ts`.
- Modificados en esta reanudación: `.harness/context/domain.md`, `.harness/context/architecture.md` y solo el frontmatter de la TASK.
- Añadido en esta reanudación: este artefacto `-attempt-2`. Renombrados: Ninguno.

Cambios preexistentes:

- Baseline: `f35484c79e4cf6f1756b8994f2e4bd3da878d85f`.
- Estado inicial tracked: `M .harness/README.md`; `M .harness/context/architecture.md`; `M .harness/context/domain.md`; `D .harness/reviews/.gitkeep`; `M .harness/templates/agents.md`; `M .harness/templates/implementation.md`; `D .harness/templates/plan.md`; `D .harness/templates/review.md`; `M .opencode/agents/sdd-implement.md`; `M .opencode/agents/sdd-init.md`; `M .opencode/agents/sdd-plan.md`; `D .opencode/agents/sdd-review.md`; `M .opencode/commands/sdd:implement.md`; `M .opencode/commands/sdd:init.md`; `M .opencode/commands/sdd:plan.md`; `D .opencode/commands/sdd:review.md`; `M apps/backend/package.json`; `M apps/backend/src/gameStateMachine.ts`; `M apps/backend/src/index.ts`; `M apps/backend/src/privateState.test.ts`; `D apps/backend/src/roundParticipants.test.ts`; `D apps/backend/src/roundParticipants.ts`.
- Estado inicial untracked: `.harness/designs/`, `.harness/implementations/2026-07-21/`, `.harness/specs/`, `.harness/tasks/`, `.harness/templates/design.md`, `.harness/templates/spec.md`, `.harness/templates/task.md`, `.opencode/agents/sdd-design.md`, `.opencode/agents/sdd-spec.md`, `.opencode/agents/sdd-task.md`, `.opencode/commands/sdd:design.md`, `.opencode/commands/sdd:spec.md`, `.opencode/commands/sdd:task.md`, `apps/backend/src/domain/`, `apps/backend/src/domainAdapter.test.ts`, `apps/backend/src/domainAdapter.ts`, `apps/backend/src/domainBoundaries.test.ts`, `apps/backend/src/domainBoundaries.ts` y `apps/backend/src/domainCoverageReporter.mjs`.
- Snapshot completo tracked: `git diff --binary` antes de editar, íntegro en `/home/jromo/.local/share/opencode/tool-output/tool_f85ebe1a5001U05D1OcQ486qiF`; `git diff --cached --binary` estaba vacío. El listado untracked anterior es el snapshot completo de rutas que Git no incluye en ese diff. Se preservaron todos los cambios ajenos.

# TASK ejecutada

- TI-01: completada; tests deterministas cubren balance 2--8, mazo/`now` fijos, inicio/retry, reparto, ready CPU/manos vacías, pausa y stale expiry; la integración Socket.IO pasa.
- TI-02: completada; `setup.ts` posee balance, reward map, inicialización, retry y reparto inmutables con tiempo, mazo y duración inyectados.
- TI-03: completada; `round.ts` usa `evaluateGameTransition()` y participantes nombrados para ready/unready, pausa, countdown y expiraciones.
- TI-04: completada; `index.ts` aplica una vez con `domainAdapter.ts`, traduce resultado y materializa efectos declarativos.
- TI-05: completada; start, retry, ready, pausa y callbacks usan dominio; no quedan referencias a `startGameInRoom`, `applyRoundReadyRequest`, `pauseRoundForReady` ni `roundParticipants`.
- TI-06: completada; checker, adaptador y pruebas verifican rechazo sin aplicación y preservación de metadata de shell.

# Cambios realizados

- `domain.md` identifica propietarios activos e invariantes exactas: balance, estrella inicial, reward map, mazo, manos, ready CPU/humano, quorum y expiración stale.
- `architecture.md` confirma dependencias inyectadas, `DomainResult`, efectos con expectativas y el scheduler de dealing/countdown.
- Sin cambios funcionales, Socket.IO, frontend, SPEC, DESIGN, otros TASKs ni implementation previa.

# Tests y cobertura

- `check:domain`: pasa.
- Backend `npm test`: 68/68 pasan, incluidos setup/ronda, adaptador/checker e integración Socket.IO.
- Backend `test:coverage`: 68/68; límite lógico (4 archivos): líneas 97.53%, branches 86.34%, funciones 100.00% (>=80%). Global: 91.56%, 82.13%, 96.47%.
- Backend `build`: pasa. `git diff --check` y búsquedas de símbolos retirados y de reloj/azar/timers en `src/domain/`: sin hallazgos.
- Frontend no se ejecutó: no se modificaron frontend ni contracts, y la validación de esta TASK enumera checker y comandos backend como relevantes.

# Documentacion actualizada

- `.harness/context/domain.md`: propietarios e invariantes confirmadas por `setup.ts`, `round.ts`, participantes y máquina canónica.
- `.harness/context/architecture.md`: límite, dependencias, efectos, scheduler y comandos reales.
- `AGENTS.md`, `README.md`, SPEC, DESIGN, otros TASKs e implementation previa: no modificados en esta reanudación.

# Comandos de validacion ejecutados

- `git rev-parse HEAD`; `git status --short`; `git diff --binary`; `git diff --cached --binary`.
- `docker compose run --build --rm --no-deps backend npm run check:domain`.
- `docker compose run --build --rm --no-deps backend npm test`.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`.
- `docker compose run --build --rm --no-deps backend npm run build`.
- `git diff --check`; búsquedas de símbolos retirados y de `Date.now()`/`Math.random()`/timers en `apps/backend/src/domain/`.

# Bloqueos o desviaciones

- Bloqueos: Ninguno.
- Desviaciones: Ninguna; la aclaración permite actualizar los dos contextos requeridos y los cambios ajenos permanecen preservados.
