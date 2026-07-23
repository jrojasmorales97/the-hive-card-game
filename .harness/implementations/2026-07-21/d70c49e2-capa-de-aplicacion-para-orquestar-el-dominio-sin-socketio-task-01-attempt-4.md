---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: implementation
created_at: 2026-07-21T22:37:55Z
created_by_command: /sdd:implement
source_prompt: |-
  Implementa y cierra exclusivamente la TASK SDD siguiente sobre el estado actual compartido:

  .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-01.md

  Sigue `.opencode/commands/sdd:implement.md` como contrato operativo completo. Existen tres implementations previas bloqueadas; debes crear el siguiente intento disponible sin sobrescribirlas. Audita todo el estado actual, pero el bloqueo conocido es TI-06: extraer y usar efectivamente `transport/socket/roomPresenter.ts`, `socketEventPublisher.ts` y un registro de handlers de sala, junto con session registry, de modo que los handlers create/join/reconnect/leave/kick/resync/disconnect solo parseen, resuelvan identidad, invoquen casos de uso y traduzcan ack. No basta crear archivos no usados: conecta composition root, elimina el camino activo anterior, conserva exactamente contratos, versiones, orden y privacidad, y añade pruebas que demuestren delegación, publicación única y separación pública/privada. Comprueba también que todos los demás TI de TASK 01 siguen satisfechos. Ejecuta test, coverage >=80% y build; crea el reporte final y marca solo esta TASK `implemented` únicamente si todo pasa. No implementes TASK 02-05, no modifiques otros artefactos previos, no reviertas cambios ajenos y no hagas commit. Devuelve salida canónica.
status: completed
task: .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-01.md
baseline: 1e747b26f985e3f17c2ff74909c3e43211ba907e
---

# Resumen de ejecucion

TASK 01 completada. La familia de sala usa ahora casos de uso sin sockets, el transporte registra sus siete comandos por separado, y presenter, publisher y registro de sesión están conectados desde el composition root sin mantener handlers de sala activos en `index.ts`.

# Alcance del cambio

Base: `1e747b26f985e3f17c2ff74909c3e43211ba907e`

Archivos modificados:

- Modificados: `.harness/context/{architecture,domain}.md`, `apps/backend/package.json`, `apps/backend/src/{index,privateState,domainBoundaries,domainCoverageReporter}.ts`, `apps/backend/src/domain/{cards,progression,round,setup,star}.ts`.
- Movidos y eliminados: `apps/backend/src/{gameStateMachine,lobbyRules,domainAdapter}.{ts,test.ts}`; sus destinos son respectivamente `domain/{stateMachine,room}.{ts,test.ts}` y `application/domainAdapter.{ts,test.ts}`.
- Añadidos: `apps/backend/src/application/{dispatcher,model,playerView,result,roomUseCases}.ts`, `application/{domainAdapter,roomUseCases}.test.ts`, `application/ports/{clock,eventPublisher,randomSource,roomRepository,scheduler}.ts`, `infrastructure/{memory/inMemoryRoomRepository,runtime/systemClock,runtime/systemRandomSource,scheduling/processScheduler}.ts`, `tooling/{layerBoundaries,testFiles}.{ts,test.ts}`, `transport/socket/{registerRoomHandlers,roomPresenter,socketEventPublisher}.{ts,test.ts}`, y `transport/socket/{sessionRegistry,sessionRegistry.test}.ts`.
- Artefactos de este cierre: esta implementation y el cambio de estado exclusivo de la TASK 01 a `implemented`.

Cambios preexistentes:

- Baseline y estado inicial capturados con `git rev-parse HEAD`, `git status --short`, `git diff --binary` y `git diff --cached --binary` antes de editar. HEAD: `1e747b26f985e3f17c2ff74909c3e43211ba907e`; staged: vacío; snapshot unstaged completo: `/tmp/opencode/d70c49e2-task-01-preexisting-unstaged.diff` (60,735 bytes).
- Se preservaron los cambios de los intentos 1--3, SPEC, DESIGN, TASKs 02--05 y toda modificación no relacionada. No se revirtió ningún cambio ajeno ni se hizo commit.

# TASK ejecutada

- TI-01: completada; inventario recursivo común para test/cobertura, checker de capas y fixtures negativos.
- TI-02: completada; máquina y reglas de sala canónicas bajo `domain/`, sin rutas antiguas ni reexports.
- TI-03: completada; modelo, resultado discriminado, dispatcher, puertos, adaptador y proyección de jugador sin Socket.IO.
- TI-04: completada; repositorio, runtime, scheduler y fakes deterministas disponibles.
- TI-05: completada; `RoomUseCases` es el único camino de create/join/reconnect/leave/kick/resync/disconnect, con commit previo, versión única, host, CPU, sala vacía y cancelación.
- TI-06: completada; `registerRoomHandlers` contiene exclusivamente la frontera wire de sala; `RoomPresenter`, `SocketEventPublisher` y `SessionRegistry` se componen en `index.ts`. Se eliminó el registro activo previo y la asociación de socket del agregado.
- TI-07: completada; pruebas de aplicación, presenter, publisher, sesión stale, integración Socket.IO, checker y búsquedas de propietario/rutas retiradas pasan.

# Cambios realizados

- `RoomPresenter` genera envelopes públicos, privados y snapshots; las manos solo salen por los destinos resueltos desde `SessionRegistry`.
- `SocketEventPublisher` materializa cada evento comprometido una vez y en orden, conserva logs acotados, versiones ya guardadas y expulsión dirigida.
- `registerRoomHandlers` preserva parsers, textos, acks, resync, reconexión, kick, leave y disconnect stale, sin mutaciones de dominio o emisiones duplicadas en los handlers.
- El cierre de sesión visual de estrella sigue recibiendo la desconexión activa; las vinculaciones socket se han retirado del estado de sala activo.

# Tests y cobertura

- `docker compose run --build --rm --no-deps backend npm test`: 76/76 tests correctos, incluidas regresiones Socket.IO de sala y juego.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`: gate lógico correcto en 12 archivos medibles: líneas 94.24%, branches 83.61%, funciones 97.50% (mínimo 80%).
- Nuevas pruebas prueban presenter público/privado, publicación única ordenada, registro de sesión stale y delegación observable a través de la suite Socket.IO.

# Documentacion actualizada

- `.harness/context/architecture.md`: límites de transporte activos, composition root, presenter, publisher, sesión, orden y privacidad.
- `.harness/context/domain.md`: responsabilidades de sala/desconexión, host, sala vacía y guardia de sesión activa.
- `AGENTS.md`: No aplica; TASK 01 prohíbe actualizarlo hasta TASK 05.

# Comandos de validacion ejecutados

- `git rev-parse HEAD`; `git status --short`; `git diff --binary`; `git diff --cached --binary`; `git diff --check`.
- `npx tsc --noEmit -p tsconfig.json` y `npm test` desde `apps/backend`.
- `docker compose run --build --rm --no-deps backend npm test`.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`.
- `docker compose run --build --rm --no-deps backend npm run build`.
- Búsquedas de handlers de sala, `socketId`, rutas retiradas e imports de la máquina/reglas antiguas.

# Bloqueos o desviaciones

Ninguno. El build local directo no se usa como gate por permisos preexistentes sobre `dist/`; el build canónico en Docker completó correctamente.
