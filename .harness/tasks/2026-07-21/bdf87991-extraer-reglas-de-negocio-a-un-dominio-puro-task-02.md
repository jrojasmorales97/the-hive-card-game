---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: task
created_at: 2026-07-21T17:47:23Z
created_by_command: /sdd:task
source_prompt: |-
  Quiero extraer las reglas de negocio desde `apps/backend/src/index.ts` hacia un dominio puro, modular y testeable.

  El objetivo no es aplicar DDD ceremonial, sino dar un unico propietario a cada regla.

  Alcance:
  - Identificar partida, ronda, jugador, mano, pila, vidas, estrellas, recompensas y consenso.
  - Extraer reglas de cartas, penalizacion, descartes, pausa, ready, estrella, nivel y final.
  - Reutilizar la maquina de estados canonica.
  - Expresar resultados mediante estado y/o eventos de dominio.
  - Migrar por slices eliminando la regla antigua al activar su reemplazo.

  Actualizacion del contexto del proyecto:
  - Actualizar `domain.md` con lenguaje ubicuo e invariantes confirmadas durante la extraccion.
  - Definir en `architecture.md` limites de domain, imports prohibidos, patrones y convenciones.
  - Registrar en `AGENTS.md` la referencia a la capa, sin duplicar sus reglas.
  - Implementar comprobaciones locales de imports basadas en `architecture.md`.

  Restricciones:
  - Domain no depende de Fastify, Socket.IO, timers, entorno, transporte o infraestructura.
  - No crear clases o interfaces por ceremonia.
  - No mantener reglas duplicadas.
  - No introducir estas restricciones en plantillas SDD genericas.

  Validacion:
  - Las reglas se prueban con datos deterministas.
  - Los limites definidos en `architecture.md` se comprueban automaticamente.
  - El comportamiento externo se conserva.
status: implemented
spec: .harness/specs/2026-07-20/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro.md
design: .harness/designs/2026-07-20/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro.md
task_number: 02
task_count: 05
---

# Objetivo

Migrar setup, inicio/retry, reparto, ready, pausa y countdown al dominio puro, conectando handlers y scheduler a resultados declarativos y eliminando las ramas antiguas en el mismo estado estable.

# Alcance y evidencia

- Aplican `CA-02`, `CA-04`, `CA-06`, `CA-07`, `CA-08`, `CA-09` y `CA-12` de la SPEC.
- Implementar `apps/backend/src/domain/setup.ts` y `round.ts` sobre la fundacion de TASK 01, con `now`, mazo/RNG y politica de duraciones inyectados.
- La evidencia actual esta en `apps/backend/src/index.ts:129-148`, `331-360`, `478-531`, `551-603`, `643-662`, `1394-1428` y `1470-1534`, ademas de `gameTiming.ts`, `levelFlow.ts`, `roundParticipants.ts`, `gameStateMachine.ts` y sus tests.
- Caracterizar balance 2-8, mapa de recompensas, estrella inicial, reparto por nivel, modo CPU, inicio manual del host, retry, reset de ready, pausa y quorum/countdown antes de sustituir cada consumidor.
- No incluye la decision de jugar/penalizar cartas, la resolucion de estrella ni la progresion posterior al vaciado de manos.

# Criterios de aceptacion

- **CA-02 / CA-06:** con entradas fijas, inicio y retry producen el mismo balance para 2-8 jugadores, nivel 1, vidas vigentes, una estrella, `maxLevel`, reward map, manos ordenadas de tantas cartas como nivel y estado inicial, sin leer reloj o azar global.
- **CA-04:** ready, unready y pausa usan solo conectados con cartas; quienes no tienen cartas no bloquean el quorum; CPU mantiene la sincronizacion vigente y quorum completo declara countdown mediante la maquina canonica.
- **CA-07:** dealing, countdown y sus expiraciones llevan `dueAt` y expectativas de fase, razon y deadline; callbacks stale o pertenecientes a un retry anterior no mutan la partida.
- **CA-08:** los eventos de inicio, reinicio y pausa y los efectos temporales contienen todo lo necesario para conservar acks, logs, emisiones y orden sin que el shell recalcule balance, participantes o deadlines.
- **CA-09:** todos los consumidores de `startGameInRoom`, rama `game:retry`, `dealLevel`, `applyRoundReadyRequest`, `pauseRoundForReady` y calculos equivalentes pasan al nuevo propietario y la implementacion anterior se elimina sin flags ni doble escritura.
- **CA-12:** se conservan mensajes de error, versiones, `game:started`, `game:restarted`, `game:paused`, snapshots privados/publicos, logs y tiempos observables bajo la escala de test.

# Tareas de implementacion

- **TI-01 — Caracterizar el slice:** ampliar tests unitarios e integracion Socket.IO para balance completo, mazo fijo, start/retry, dealing, ready de humanos/CPU, pausa, quorum con manos vacias y expiraciones validas/stale.
- **TI-02 — Extraer setup:** implementar balance, reward map, inicializacion, retry y reparto inmutable en `domain/setup.ts`; recibir mazo ya barajado o RNG inyectado, `now` y duraciones, y devolver eventos/efectos explicitos.
- **TI-03 — Extraer ciclo de ronda:** implementar ready/unready, pausa, inicio de countdown y expiraciones en `domain/round.ts`, autorizando cada comando con `evaluateGameTransition()` y reutilizando poblaciones nombradas.
- **TI-04 — Materializar efectos:** adaptar `index.ts` para parsear, construir dependencias productivas, invocar dominio, aplicar una vez mediante `domainAdapter.ts`, traducir eventos en el orden baseline y programar efectos sin decisiones de negocio.
- **TI-05 — Sustituir atomicamente:** conectar `game:start`, `game:retry`, `player:ready`, `game:pause-request` y callbacks de dealing/countdown al dominio; eliminar en el mismo cambio las ramas y helpers equivalentes antiguos, incluidos restos de `roundParticipants.ts` que queden sin consumidor.
- **TI-06 — Confirmar compatibilidad:** buscar simbolos retirados, validar que CPU y resync siguen usando el estado adaptado y demostrar que un rechazo no incrementa version ni crea timers.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests deterministas de `domain/setup.ts` y `domain/round.ts` con tablas 2-8, mazos y `now` fijos, repeticion profunda e inmutabilidad de entrada.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Mantener `>= 80%` en lineas, branches y funciones del limite de dominio y cubrir todas las ramas nuevas/modificadas de adaptacion medibles.
- Ejecutar `npm run check:domain` mediante los scripts encadenados y buscar referencias activas a los helpers sustituidos, `Date.now()`/`Math.random()` dentro del limite y timers programados fuera del shell.

# Documentacion aplicable

- Actualizar `.harness/context/domain.md` con invariantes confirmadas de balance, inicio manual, reparto, retry, ready, pausa y quorum.
- Actualizar `.harness/context/architecture.md` solo si la implementacion confirma detalles del patron ya aprobado de dependencias inyectadas, eventos o materializacion de efectos; no duplicar reglas funcionales.

# Riesgos y restricciones

- Mitigar R-01 preservando orden de aplicacion, version, emision y log; mitigar R-03 incluyendo expectativas completas en cada efecto temporal.
- Mitigar R-04 borrando cada rama antigua al conectar su consumidor y verificando referencias antes de cerrar el slice.
- No modificar payloads/contracts, no introducir timers, reloj o azar en el dominio y no iniciar reglas de cartas, estrella o progresion posterior.
- Conservar el inicio manual por host con dos conectados; no reinstaurar el ready previo incorrecto del README.
