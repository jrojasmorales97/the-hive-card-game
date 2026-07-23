---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: implementation
created_at: 2026-07-21T22:54:50Z
created_by_command: /sdd:implement
source_prompt: |-
  Implementa exclusivamente esta TASK SDD siguiendo `.opencode/commands/sdd:implement.md` como contrato operativo completo:

  .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-02.md

  TASK 01 está validada como `implemented` y su implementation final está `completed`; parte del estado actual compartido. Esta es la segunda ola de la cadena 01→02→03→04→05. Captura baseline y cambios preexistentes, respeta TASK/DESIGN/SPEC/contexto, completa todos los `TI-*` de inicio/retry/dealing, ejecuta tests, coverage y build, crea su reporte de implementation y cambia únicamente esta TASK a `implemented` si queda completa. No implementes ready/pausa, juego/progresión/CPU ni estrella de TASK 03-05, no modifiques otros artefactos previos, no reviertas cambios ajenos y no hagas commit. Devuelve el formato canónico.
status: completed
task: .harness/tasks/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio-task-02.md
baseline: 1e747b26f985e3f17c2ff74909c3e43211ba907e
---

# Resumen de ejecucion

TASK 02 completada. Inicio, retry y expiración de dealing se orquestan desde aplicación sin sockets, azar, reloj ni timers reales; los handlers son adaptadores de ack y se preservan los eventos, versiones, logs y regresiones Socket.IO.

# Alcance del cambio

Base: `1e747b26f985e3f17c2ff74909c3e43211ba907e`

Archivos modificados:

- Añadidos: `apps/backend/src/application/{gameUseCases,effectUseCases}.{ts,test.ts}` y esta implementation.
- Modificados para esta TASK: `.harness/context/{architecture,domain}.md`, la TASK 02, `apps/backend/src/{index.ts,application/{dispatcher,domainAdapter,result}.ts,domain/setup.ts,infrastructure/scheduling/processScheduler.ts,transport/socket/socketEventPublisher.ts}`.
- Sin archivos renombrados ni eliminados por esta TASK; no se modificaron frontend, contracts, TASK 03--05, implementations previas ni agentes.

Cambios preexistentes:

- Baseline capturado antes de editar con `git rev-parse HEAD`: `1e747b26f985e3f17c2ff74909c3e43211ba907e`. Estado staged inicial: vacío. Snapshot binario unstaged completo: `/tmp/opencode/d70c49e2-task02-preexisting-unstaged.diff` (74,413 bytes); snapshot staged completo: `/tmp/opencode/d70c49e2-task02-preexisting-staged.diff` (0 bytes).
- Estado inicial preservado: modificaciones de contexto, paquete backend, dominio, `index.ts`, checker/reporter y private state; eliminaciones de las rutas planas migradas; y artefactos sin seguimiento de SPEC/DESIGN/TASKs 01--05, implementations TASK 01, `application/`, `infrastructure/`, `transport/`, `tooling/`, `domain/room` y `domain/stateMachine` procedentes de TASK 01.
- No se revirtió ningún cambio preexistente ni se hizo commit.

# TASK ejecutada

- TI-01: completada; se caracterizaron permisos, estados, balances, reparto, ready humano/CPU, textos, versiones y orden mediante los tests de dominio e integración existentes y los nuevos fakes de aplicación.
- TI-02: completada; `gameUseCases.ts` construye un mazo Fisher--Yates de 100 cartas con `RandomSource`, lo difiere hasta superar autorización y consume exactamente 99 valores por inicio/retry aceptado.
- TI-03: completada; `startGame` y `retryGame` usan repositorio, reloj, random, publisher y scheduler, guardan una sola revisión esperada y devuelven cambios, eventos y efectos con `roomCode` y versión.
- TI-04: completada; `effectUseCases.ts` recibe el efecto original, valida sala, versión, fase, lock y deadline mediante dominio, guarda y despacha solo en éxito; el scheduler reemplaza por `{ roomCode, trigger }`.
- TI-05: completada; `game:start` y `game:retry` solo resuelven contexto, invocan `GameUseCases` y traducen el ack. El publisher conserva update/snapshot, `game:started`/`game:restarted` y log en el orden baseline.
- TI-06: completada; búsqueda estática confirma que los handlers ya no llaman dominio, barajan, mutan, publican ni programan esta familia; `dealing-expired` no queda activo en el scheduler legacy de `index.ts`.

# Cambios realizados

- `ApplicationEffect` conserva sala y versión esperada; el dispatcher publica y agenda una vez después del commit.
- `gameUseCases` mantiene autorizaciones y mensajes literales de `domain/setup.ts`, respeta el lock/retry banner y conserva readiness humana/CPU decidida por dominio.
- `effectUseCases` rechaza antes de `dueAt`, sala borrada, versión distinta, retry y locks/deadlines stale sin escribir, publicar ni reprogramar.
- `SocketEventPublisher` materializa los eventos de inicio y reinicio sin recalcular reglas; `ProcessScheduler` cancela/reemplaza por clave y cede el turno de ack antes de publicar el snapshot vencido.

# Tests y cobertura

- Nuevos tests sin red cubren determinismo, inmutabilidad, rechazos, commit/publicación única, reemplazo de dealing y expiración antes/en/después de `dueAt`, versión, retry y sala borrada.
- `docker compose run --build --rm --no-deps backend npm test`: 80/80 tests correctos, incluidas regresiones Socket.IO de start, host/retry, derrota, privacidad y permanencia de sala.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`: 14 archivos lógicos medibles; líneas 94.78%, branches 84.17%, funciones 97.19% (mínimo >=80%).
- `docker compose run --build --rm --no-deps backend npm run build`: correcto.

# Documentacion actualizada

- `.harness/context/domain.md`: asigna inicio/retry y dealing a `gameUseCases.ts`/`effectUseCases.ts`, con permisos, versión y guardas stale.
- `.harness/context/architecture.md`: documenta Fisher--Yates inyectado, dispatcher, clave de scheduler y continuación de dealing sin migrar handlers ready/pausa.
- `AGENTS.md`, README y contracts: No aplica; no cambian en esta TASK.

# Comandos de validacion ejecutados

- `git rev-parse HEAD`; `git status --short`; `git diff --binary`; `git diff --cached --binary`; `git diff --check`.
- `npx tsc --noEmit -p tsconfig.json`; `npm test`; `npm run test:coverage` desde `apps/backend`.
- Búsquedas estáticas de handlers start/retry, `dealing-expired`, `buildDeck`, imports prohibidos y propietario único.
- `docker compose run --build --rm --no-deps backend npm test`.
- `docker compose run --build --rm --no-deps backend npm run test:coverage`.
- `docker compose run --build --rm --no-deps backend npm run build`.

# Bloqueos o desviaciones

No hay bloqueos. Desviación técnica acotada: el scheduler de infraestructura añade una gracia máxima de 10 ms y entrega el callback en el siguiente turno de evento para que el ack ya comprometido pueda salir antes del snapshot. El efecto conserva su `dueAt` original, y las guardas de versión/fase/lock/deadline, el dominio y los contratos wire no cambian.
