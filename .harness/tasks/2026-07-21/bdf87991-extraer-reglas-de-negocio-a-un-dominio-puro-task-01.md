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
task_number: 01
task_count: 05
---

# Objetivo

Establecer el limite puro del dominio, su adaptacion atomica y sus guardas automaticas, y migrar las poblaciones de participantes y la autorizacion a un unico propietario sin alterar contratos ni comportamiento Socket.IO.

# Alcance y evidencia

- Aplican `CA-01`, `CA-02`, `CA-07`, `CA-08`, `CA-09`, `CA-11`, `CA-12` y `CA-13` de la SPEC.
- Crear la fundacion acordada en `apps/backend/src/domain/model.ts`, `result.ts` y `participants.ts`; conservar `apps/backend/src/gameStateMachine.ts` como parte del limite logico y crear `apps/backend/src/domainAdapter.ts`.
- La evidencia actual esta en `apps/backend/src/index.ts:61-127`, `440-476`, `apps/backend/src/gameStateMachine.ts`, `apps/backend/src/roundParticipants.ts`, `apps/backend/src/privateState.ts`, sus tests co-localizados y la separacion wire de `packages/contracts/src/state.ts`.
- Incluir `apps/backend/src/domainBoundaries.ts`, el gate de cobertura del dominio y los scripts definidos por D-07 y D-08, usando TypeScript 5.8.2 y el runner `node:test` de Node 20 ya instalados.
- Caracterizar antes de sustituir: poblaciones ready/play/pause/consensus/settlement, decisiones de fase/actor/lock, proyeccion de acciones privadas, rechazo sin mutacion y preservacion de metadata por el adaptador.
- No incluye aun migrar setup, ciclo de ronda, cartas, estrella, progresion ni scoring; sus propietarios vigentes deben quedar inventariados sin duplicar su ejecucion.

# Criterios de aceptacion

- **CA-01 / CA-09:** existe un inventario trazable de propietarios actuales y objetivo, y las poblaciones nombradas tienen un solo predicado activo; no quedan consumidores de los predicados equivalentes de `roundParticipants.ts`.
- **CA-02 / CA-13:** `DomainMatch`, `DomainPlayer`, `DomainGame`, `DomainResult`, `DomainEvent` y `DomainEffect` representan solo datos o variaciones reales del diseno, no mutan entradas y no dependen del wire ni de infraestructura.
- **CA-07:** `evaluateGameTransition()` sigue siendo la unica autoridad de fase, actor, lock y expiracion; importa vocabulario funcional desde `domain/model.ts`, y `buildPrivateActions()` obtiene `enabled/reason` de `commandDecision()` sin autorizacion paralela.
- **CA-08:** un resultado exitoso entrega estado completo, eventos y efectos; un rechazo entrega el error y no modifica estado, version, logs ni timers.
- **CA-11:** `npm run check:domain` inspecciona por AST `src/domain/**` y `src/gameStateMachine.ts`, pasa sobre el arbol real y falla de forma explicita para imports de Fastify, Socket.IO, `@fastify/*`, `node:*`, shell/frontend/infraestructura, imports dinamicos y usos de `process`, `Date.now`, `Math.random`, timers o clears prohibidos.
- **CA-11:** `test`, `test:coverage` y `build` ejecutan antes la guarda; `test:coverage` falla si el limite medible baja de 80% en lineas, branches o funciones, excluyendo tests y archivos solo declarativos.
- **CA-12:** el adaptador copia solo estado funcional y fusiona un exito conservando `code`, `displayCode`, `shareable`, `socketId`, `version`, logs y estado de proceso; no cambia payloads, acks, eventos, privacidad ni exports de `@the-hive/contracts`.

# Tareas de implementacion

- **TI-01 — Congelar caracterizacion:** ampliar `gameStateMachine.test.ts`, `roundParticipants.test.ts`, `privateState.test.ts` y tests de adaptacion para cubrir matrices de fase, conexion, mano, CPU, ready, consenso y settlement, mas inmutabilidad y metadata, antes de retirar predicados.
- **TI-02 — Modelar el limite:** implementar los tipos funcionales acordados en `domain/model.ts`, los discriminantes de `DomainResult`, `DomainEvent` y `DomainEffect` en `domain/result.ts`, y fixtures deterministas reutilizables sin clases ceremoniales ni tipos wire.
- **TI-03 — Unificar participantes y maquina:** implementar las cinco poblaciones nombradas en `domain/participants.ts`, hacer que la maquina y sus consumidores las reutilicen, y retirar los predicados duplicados de `roundParticipants.ts` en el mismo cambio; conservar solo helpers de ronda aun no migrados que no vuelvan a decidir elegibilidad.
- **TI-04 — Implementar adaptacion atomica:** crear conversion `Room -> DomainMatch`, aplicacion de `DomainResult` y pruebas de compatibilidad estructural en `domainAdapter.ts`; asegurar que el rechazo es un no-op y que eventos/efectos quedan disponibles al shell sin recalcular reglas.
- **TI-05 — Automatizar limites:** implementar el checker AST y sus fixtures positivos/negativos por categoria, agregar `check:domain` a `apps/backend/package.json` y encadenarlo antes de test, cobertura y build sin dependencias nuevas.
- **TI-06 — Aplicar gate de cobertura:** incluir solo archivos productivos del limite logico, consumir el evento/reporte de cobertura de Node 20 y fallar por debajo de 80% en cualquiera de lineas, branches o funciones; mantener visible la cobertura global.
- **TI-07 — Verificar propietario unico:** buscar referencias a predicados retirados y autorizaciones paralelas, eliminar reexports transitorios que ya no tengan consumidores y confirmar que no existe flag ni doble escritura.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar `docker compose run --build --rm --no-deps backend npm run check:domain` y verificar tanto el arbol real como cada fixture negativo del checker.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Exigir `>= 80%` en lineas, branches y funciones sobre `apps/backend/src/domain/**/*.ts` y `apps/backend/src/gameStateMachine.ts`, excluyendo tests y archivos declarativos; revisar tambien que la linea base de integracion Socket.IO siga pasando.
- Validar con busqueda estatica que no quedan imports/globales prohibidos ni predicados de participantes duplicados, y que `.harness/templates/` no cambia.

# Documentacion aplicable

- Actualizar `.harness/context/architecture.md` con el limite fisico/logico, direccion de dependencias, `DomainResult`, adaptador, imports/globales prohibidos, `check:domain`, gate de cobertura y patron de migracion por slice.
- Actualizar `.harness/context/domain.md` con el lenguaje ubicuo del modelo y el inventario de propietarios, marcando como vigentes los propietarios aun no migrados y sin convertir incertidumbres en reglas.
- No modificar `AGENTS.md` ni `README.md` en este slice salvo que sea imprescindible para que un comando ya introducido sea descubrible; su cierre canonico corresponde a TASK 05.

# Riesgos y restricciones

- Mitigar R-02 con tests de fusion de metadata y R-05 con tablas separadas para cada poblacion.
- Mitigar R-07 y R-08 con gate por limite y fixtures negativos AST por categoria, no mediante regex.
- La maquina canonica conserva ruta y API autoritativa; el dominio no importa contratos, Fastify, Socket.IO, Node, entorno, reloj, azar ni timers.
- No crear abstracciones sin variacion real, no cambiar contracts ni frontend, no modificar plantillas SDD y no iniciar una regla funcional de slices posteriores.
