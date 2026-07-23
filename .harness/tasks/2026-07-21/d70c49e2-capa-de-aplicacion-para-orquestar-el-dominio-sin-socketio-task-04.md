---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: task
created_at: 2026-07-21T22:08:01Z
created_by_command: /sdd:task
source_prompt: |-
  Quiero introducir una capa de aplicacion que orqueste el dominio sin depender de Socket.IO.

  Alcance:
  - Crear casos de uso para sala, reconexion, inicio, ready, jugar, pausa, estrella, retry y desconexion.
  - Definir dependencias para repositorio, eventos, reloj, random y scheduler.
  - Devolver resultados tipados con cambios, errores y eventos.
  - Crear `application/` por familias cohesivas, con puertos bajo `application/ports/` solo para dependencias externas reales.
  - Normalizar la ubicacion fisica de la maquina canonica dentro de `domain/` al poder actualizar todos sus consumidores y checks en un unico slice.
  - Migrar por familias manteniendo contratos externos.
  - Anadir tests con fakes deterministas.

  Actualizacion del contexto del proyecto:
  - Relacionar en `domain.md` requirements y permisos con los casos de uso responsables.
  - Definir en `architecture.md` application layer, puertos y direccion de dependencias.
  - Actualizar `AGENTS.md` con una referencia al mapa de casos de uso.
  - Automatizar localmente las reglas de imports descritas en `architecture.md`.

  Restricciones:
  - Los casos de uso no reciben sockets.
  - `application/` no importa Fastify, Socket.IO ni implementaciones de `infrastructure/`.
  - No crear una interfaz por funcion sin limite real.
  - No crear carpetas genericas `services`, `helpers`, `managers` o `utils`.
  - No cambiar contratos publicos.
  - No copiar estas reglas a agentes SDD genericos.

  Validacion:
  - Los handlers migrados delegan en casos de uso.
  - Los casos de uso se prueban sin red.
  - Autorizacion y errores coinciden con `domain.md`.
  - Los tests de subdirectorios se descubren realmente y los checks prueban `application -> domain` sin aristas inversas.
status: implemented
spec: .harness/specs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md
design: .harness/designs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md
task_number: 04
task_count: 05
---

# Objetivo

Migrar jugar, penalizacion, cierre/progresion de nivel, terminales y turnos CPU a `gameUseCases.ts`/`effectUseCases.ts`, manteniendo el dominio como unico decisor y todos los callbacks deterministas y stale-safe.

# Alcance y evidencia

- Aplican `CA-01`, `CA-02`, `CA-03`, `CA-04`, `CA-06`, `CA-07`, `CA-09`, `CA-11` y la trazabilidad de `CA-12`.
- Implementar `playCard` en `gameUseCases.ts` y callbacks de error, flip/unflip, siguiente nivel, liberacion de nivel y turno CPU en `effectUseCases.ts`.
- Orquestar `domain/cards.ts`, `domain/progression.ts`, `domain/scoring.ts` y reparto de `domain/setup.ts` sin recalcular minimo, bloqueantes, penalizacion, outcome, recompensa, progreso, terminales o ranking.
- Migrar `game:play-card` y toda materializacion asociada; extraer el scheduling CPU de `index.ts` a infraestructura/efectos usando las mismas claves, duraciones y condiciones declaradas.
- La linea base esta en `apps/backend/src/index.ts:448-654`, `1254-1269`, `domain/cards.ts`, `domain/progression.ts`, `domain/scoring.ts`, `domain/setup.ts` y `socketIntegration.test.ts:202-255`, `312-368`.
- No incluye estrella; una jugada puede cancelar propuesta conforme al dominio, pero sus comandos y settlement conservan propietario hasta TASK 05.

# Criterios de aceptacion

- **CA-02 / CA-03:** `playCard` y cada callback se prueban sin red, reloj real, azar o timers; rechazo no muta y exito devuelve todo cambio/evento/efecto requerido.
- **CA-04:** se preservan minimo propio, bloqueantes ordenadas, perdida de una vida, errorCounts, descartes, locks, outcomes, recompensas/topes, avance, derrota, victoria y scoring sin reglas duplicadas en aplicacion/transporte.
- **CA-04:** pausa automatica tras error no emite `game:paused`; juego/pausa usan conectados con cartas y el turno CPU solo se programa tras continuidad aceptada.
- **CA-06:** se conservan acks, textos, `game:error-penalty`, logs de carta/error/descarte/nivel/recompensa/terminal, versiones, snapshots, privacidad y orden observable.
- **CA-07:** scheduler reemplaza trabajos por `{ roomCode, key }`; cada callback recarga, valida efecto/version/fase/lock/deadline y guarda/publica a lo sumo una vez.
- **CA-09:** handler, callbacks de cartas/progresion y turno CPU delegan exclusivamente en aplicacion; se eliminan `playCardWithDomain`, traductores, Maps/timers y helpers previos de esta familia.
- **CA-11:** fakes cubren exito/rechazos, error y juego ordenado, callbacks antes/en/despues de deadline, retry, lock/version divergente, sala borrada, CPU y recorrido completo a derrota/victoria.

# Tareas de implementacion

- **TI-01 — Caracterizar juego y progresion:** fijar matrices de permisos/errores, orden de eventos, version, pausas automaticas, locks, recompensas, terminales, ranking y decisiones CPU antes de sustituir el camino actual.
- **TI-02 — Implementar playCard:** adaptar dominio, repositorio, reloj y dispatcher en `gameUseCases.ts`, incluyendo inventario completo de eventos/efectos y cancelacion/reemplazo de trabajos sin recalculo de reglas.
- **TI-03 — Implementar callbacks de cartas:** encauzar `error-expired`, `round-flip-expired` y `round-unflip-expired` por `effectUseCases.ts` con guardas stale y continuacion decidida por dominio.
- **TI-04 — Implementar progresion y terminales:** encauzar `next-level-expired`, `level-ready-expired`, reparto, recompensa, derrota/victoria y scoring, usando reloj/random inyectados y resultados de dominio.
- **TI-05 — Extraer turno CPU:** programar y ejecutar CPU por scheduler/efecto con la misma demora y condiciones, sin que infraestructura decida minimo, fase, outcome o progreso.
- **TI-06 — Migrar transporte y retirar shell:** redirigir `game:play-card`, conservar parser/ack y eliminar traductores, materializadores, Maps, timers y helpers antiguos de cartas/progresion/CPU.
- **TI-07 — Auditar propietario unico:** buscar mutaciones o calculos de mano, vidas, bloqueantes, reward, nivel, terminales, scoring y CPU fuera de dominio/aplicacion permitidos y retirar duplicados.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests unitarios deterministas de juego, callbacks, progresion y CPU con fakes, comparando estado, cambios, eventos, efectos, orden, version y no-op stale.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Exigir `>= 80%` en lineas, branches y funciones sobre codigo nuevo o modificado y ejecutar regresiones Socket.IO de penalizacion, pausa silenciosa, cierre de nivel, derrota/retry y victoria completa.
- Validar checker y busquedas de handlers/callbacks/simbolos antiguos, y confirmar que cada efecto se publica/programa una vez y ningun callback stale guarda.

# Documentacion aplicable

- Actualizar `.harness/context/domain.md` con `playCard`, poblaciones, callbacks, progresion/CPU y propietarios de penalizacion, outcomes, recompensas y terminales.
- Actualizar `.harness/context/architecture.md` con las claves de scheduler y el flujo realmente implementado para cartas, progresion y CPU.
- No aplica cambio de contratos publicos; mantener `AGENTS.md` para el cierre de TASK 05.

# Riesgos y restricciones

- Mitigar callbacks de fase previa/retry/sala borrada con claves cancelables, version esperada y guardas completas; mitigar duplicados con dispatcher unico.
- Mitigar divergencias de orden/version con regresiones de eventos, logs y snapshots; mantener separacion publica/privada en cada actualizacion.
- Mitigar doble propietario retirando en el mismo slice toda traduccion que derive bloqueantes, outcome, recompensa, progreso, terminal o turno CPU.
- No cambiar contracts, balance, scoring, duraciones, frontend ni reglas; no crear sockets, timers reales o imports de infraestructura en aplicacion.
