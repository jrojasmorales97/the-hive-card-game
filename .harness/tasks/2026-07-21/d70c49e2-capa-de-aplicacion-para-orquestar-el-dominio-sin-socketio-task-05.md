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
task_number: 05
task_count: 05
---

# Objetivo

Migrar propuesta, voto, cancelacion, rechazo y cierre visual de estrella a `starUseCases.ts`/`effectUseCases.ts`, hacer converger ack, desconexion y deadline en un settlement unico, y cerrar trazabilidad, documentacion y validacion integral.

# Alcance y evidencia

- Aplican `CA-01` a `CA-12` para el cierre completo, con foco en `CA-03`, `CA-04`, `CA-05`, `CA-06`, `CA-09`, `CA-11` y `CA-12`.
- Implementar `proposeStar`, `acceptStar`, `cancelStar`, `rejectStar` y `completeStarAnimation` en `starUseCases.ts`; encauzar `star-settled` y efectos posteriores por `effectUseCases.ts`.
- Conservar en estado de aplicacion el efecto de settlement y las identidades humanas pendientes; ack, disconnect activo y deadline actualizan esa espera y consumen el settlement una sola vez.
- Migrar los cinco handlers `star:*`, retirar `starAnimation.ts`, Maps/timers, traductores y materializacion anterior del shell, y completar la reduccion de `index.ts` a composition root/lifecycle.
- La linea base esta en `apps/backend/src/index.ts:656-730`, `773-828`, `1292-1363`, `starAnimation.ts`, `domain/star.ts`, `domain/cards.ts:86-124` y `socketIntegration.test.ts:257-310`.
- Cerrar la matriz completa contra `packages/contracts/src/events/maps.ts`, contexts, `AGENTS.md`, README, scripts, arbol real y todos los propietarios migrados.

# Criterios de aceptacion

- **CA-03 / CA-04:** propuesta, votos repetidos, cancelacion, rechazo, consenso, preview, consumo y settlement preservan permisos, textos, poblaciones y resultados de dominio; rechazo no muta ni despacha.
- **CA-04 / CA-05:** consenso incluye conectados aun sin cartas; settlement incluye manos no vacias aun desconectadas; desconexion solo cierra espera visual y no altera por si misma mano, recurso o outcome.
- **CA-03 / CA-07:** ack parcial/total, disconnect y timeout convergen en un unico `star-settled`; duplicados y callbacks stale son no-op sin segunda mano mutada, guardado, evento o efecto.
- **CA-06:** se conservan `game:star-used`, logs, snapshots, versiones, privacidad, orden y ack; la mano cambia solo en settlement y una pausa automatica posterior no emite `game:paused`.
- **CA-09:** todos los handlers/callbacks de estrella delegan en aplicacion y desaparecen `starAnimation.ts`, Maps, timers y helpers previos sin doble propietario ni feature flag.
- **CA-01 / CA-08 / CA-11:** el mapa final cubre las nueve familias; todos los tests anidados se descubren, checker/gate pasan y no quedan imports prohibidos, aristas inversas, rutas antiguas ni archivos ejecutables fuera de medicion.
- **CA-12:** `domain.md`, `architecture.md` y `AGENTS.md` reflejan casos de uso, permisos, puertos y direccion real; README solo cambia para checks/separacion backend aplicables y ningun agente SDD generico recibe estas reglas.

# Tareas de implementacion

- **TI-01 — Caracterizar estrella:** fijar propuesta, voto repetido, cancelacion, rechazo, consenso, preview, ack parcial/total, desconexion, timeout, settlement y pausa/cierre con poblaciones y tiempos deterministas.
- **TI-02 — Implementar casos de uso:** crear `starUseCases.ts`, adaptar resultados de `domain/star.ts`, persistir la espera visual por identidades y devolver cambios/eventos/efectos completos sin sockets.
- **TI-03 — Unificar settlement:** hacer que ack, disconnect y scheduler invoquen la misma transicion de aplicacion, consuman una sola vez el efecto original y encaucen round flip/outcome por `effectUseCases.ts`.
- **TI-04 — Migrar transporte y retirar shell:** redirigir los cinco handlers, conservar solo sesion/ack wire y eliminar `starAnimation.ts`, pendientes, timers, traductores y helpers antiguos.
- **TI-05 — Auditar arquitectura final:** verificar que `index.ts` solo compone Fastify, infraestructura, aplicacion y transporte/lifecycle; buscar todos los handlers, Maps, timers, imports y reglas antiguas para confirmar propietario unico.
- **TI-06 — Consolidar documentacion:** completar matrices de requisitos/permisos/poblaciones/casos de uso, estructura y puertos; actualizar `AGENTS.md` solo con referencias y README solo donde los comandos/rutas finales lo exijan.
- **TI-07 — Ejecutar cierre integral:** correr checks, tests, cobertura y builds backend/frontend, revisar diff de contracts y agentes SDD genericos, y confirmar todos los `CA-*` sin ampliar alcance.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests unitarios de `starUseCases` y `effectUseCases` con repositorio, publisher, reloj y scheduler falsos, cubriendo cada rechazo, inmutabilidad, orden, ejecucion unica y callback stale.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Ejecutar `docker compose run --build --rm --no-deps frontend npm test`, `docker compose run --build --rm --no-deps frontend npm run test:coverage` y `docker compose run --build --rm --no-deps frontend npm run build`.
- Exigir `>= 80%` en lineas, branches y funciones para dominio/aplicacion medibles; ejecutar toda la suite Socket.IO y comparar acks, textos, eventos, logs, versiones, snapshots, privacidad y orden.
- Validar por checker y busqueda ausencia de `starAnimation.ts`, rutas canonicas antiguas, handlers/callbacks dobles, imports prohibidos, aristas inversas, carpetas genericas y cambios en `packages/contracts/` o agentes SDD genericos.

# Documentacion aplicable

- Completar `.harness/context/domain.md` con la matriz requirement/permiso/poblacion/caso de uso/operacion de dominio para las nueve familias, preservando incertidumbres no resueltas.
- Completar `.harness/context/architecture.md` con estructura real, cinco puertos, `ApplicationResult`, dispatcher, session registry, direccion de imports, scheduler, tooling y reglas de migracion ya materializadas.
- Actualizar `AGENTS.md` con una referencia breve al mapa de casos de uso de `domain.md` y a `application/`, sin duplicar reglas.
- Actualizar README solo si cambiaron nombres/rutas de checks o la descripcion de separacion backend; no documentar cambios de contrato publico porque no existen.

# Riesgos y restricciones

- Mitigar settlement incompleto/duplicado con estado persistido por sala, consumo idempotente y pruebas de carrera entre ack, disconnect y timeout.
- Mitigar callbacks stale, orden/version divergente, doble materializacion y exposicion de mano con expectativas/version, dispatcher unico, secuencias exactas y presenters separados.
- Mitigar doble propietario con eliminacion en el mismo slice y auditoria final; mitigar complejidad accidental manteniendo exactamente los cinco puertos aprobados.
- No cambiar contracts, frontend funcional, mensajes, reglas, topologia o persistencia; no crear sockets en aplicacion, carpetas genericas, reexports, feature flags ni reglas de proyecto en agentes SDD genericos.
