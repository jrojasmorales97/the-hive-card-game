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
task_number: 03
task_count: 05
---

# Objetivo

Migrar juego de cartas, historial, penalizacion de vida, errores, descartes y resolucion posterior a `domain/cards.ts`, preservando la autorizacion canonica y el comportamiento realtime sin una segunda implementacion activa.

# Alcance y evidencia

- Aplican `CA-02`, `CA-03`, `CA-07`, `CA-08`, `CA-09` y `CA-12` de la SPEC.
- La evidencia actual esta en `apps/backend/src/index.ts:591-614`, `719-846`, `gameStateMachine.ts:147-153`, `gameTiming.ts:25-35`, `roundResolution.ts`, `gameTiming.test.ts`, `roundResolution.test.ts` y el escenario de cartas/error de `socketIntegration.test.ts`.
- Caracterizar carta ajena, carta propia no minima, jugada valida, uno o varios bloqueantes, historial, cancelacion de propuesta activa, vida limitada a cero, errorCount, descartes ordenados y outcomes de pausa, nivel completo o derrota.
- Inyectar `now` y politica de duraciones; declarar lock/error y cierre de ronda como efectos con expectativas stale, sin timers reales en el dominio.
- No incluye consenso/settlement de estrella ni calculo de recompensas, avance de nivel o scoring; los hechos de cartas deben permitir a esos propietarios reaccionar sin recalcular esta regla.

# Criterios de aceptacion

- **CA-03:** solo se acepta una carta presente y minima de la mano del actor; la jugada se registra una vez en pila e historial con `now` inyectado.
- **CA-03:** si hay cartas globalmente menores, el resultado pierde exactamente una vida con suelo cero, incrementa una vez el error del actor, descarta todas las bloqueantes y emite hechos suficientes; sin bloqueantes no penaliza.
- **CA-07:** fase, actor y lock se autorizan con `evaluateGameTransition()`; expiraciones de error y cierre de ronda validan fase/lock/deadline y rechazan callbacks stale sin mutacion.
- **CA-08:** el resultado expresa carta jugada, penalizacion, cada descarte y outcome posterior, mas efectos necesarios; `index.ts` solo traduce a los acks, logs y eventos existentes.
- **CA-09:** `playCardInRoom`, `resolveErrorAndDiscard`, `discardLowerCards` y calculos de outcome equivalentes dejan de decidir o se eliminan cuando `game:play-card` usa el dominio.
- **CA-12:** se conservan textos de rechazo, `game:error-penalty`, logs `game:card-played`/`game:error`/`game:discard`, versionado, privacidad, orden funcional, pausa tras overlay, derrota y cierre de nivel.

# Tareas de implementacion

- **TI-01 — Caracterizar cartas:** ampliar tests de dominio e integracion con manos fijas para cada rechazo, jugada correcta, multiples bloqueantes, suelo de vidas, errorCount, pila/historial, pausa, nivel completo y game over.
- **TI-02 — Implementar `domain/cards.ts`:** modelar el comando de jugar y sus expiraciones, invocar la maquina canonica, producir estado inmutable, eventos discriminados y efectos declarativos usando `now` y duraciones inyectados.
- **TI-03 — Conectar el handler:** hacer que `game:play-card` parsee el payload, invoque dominio y aplique el resultado una sola vez; traducir eventos a emisiones/logs actuales y materializar efectos en el scheduler sin recalcular bloqueantes u outcome.
- **TI-04 — Retirar propietarios antiguos:** eliminar o absorber `playCardInRoom`, `resolveErrorAndDiscard`, `discardLowerCards`, `getRoundResolutionOutcome` y helpers de error/cierre que queden sin consumidor; mover sus tests al nuevo propietario y evitar reexports transitorios innecesarios.
- **TI-05 — Verificar interaccion de slices:** confirmar que pausa/ready de TASK 02 recibe el hecho de continuidad, que progresion vigente recibe el hecho de nivel/derrota sin volver a decidir cartas y que CPU programa su siguiente accion solo desde el resultado aceptado.
- **TI-06 — Auditar compatibilidad:** buscar implementaciones duplicadas de minimo, bloqueantes, perdida de vida, errorCount, descarte y outcome, y comparar snapshots/acks/eventos antes y despues.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests deterministas de `domain/cards.ts` dos veces sobre la misma entrada y comprobar igualdad profunda e inmutabilidad.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Mantener `>= 80%` en lineas, branches y funciones del limite y cubrir las ramas modificadas del adaptador/handler cuando sean medibles.
- Confirmar por busqueda que los simbolos y calculos antiguos no siguen activos, que `npm run check:domain` pasa y que el escenario Socket.IO de carta correcta/error/pausa/derrota conserva resultados y privacidad.

# Documentacion aplicable

- Actualizar `.harness/context/domain.md` con invariantes confirmadas de carta minima propia, bloqueantes, vida, error, descartes y outcomes.
- Actualizar el inventario de propietarios documentado para marcar `domain/cards.ts` como unico propietario y retirar rutas antiguas eliminadas.

# Riesgos y restricciones

- Mitigar R-01 preservando el orden actual de estado, version, evento y logs, y R-03 validando expectativas temporales completas.
- Mitigar R-04 retirando todos los calculos equivalentes en el mismo cambio; un adaptador no puede volver a decidir elegibilidad, penalizacion o outcome.
- No reinterpretar scoring ni el alcance de `pileHistory` (R-09), no cambiar contracts/frontend y no introducir mutacion de entrada, reloj o timers en dominio.
