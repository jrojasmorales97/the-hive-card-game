---
id: c4e8a1f2
slug: encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory
type: task
created_at: 2026-07-23T08:57:53Z
created_by_command: /sdd:task
source_prompt: |-
  Quiero encapsular la infraestructura backend detras de puertos manteniendo el comportamiento in-memory.

  Alcance:
  - Encapsular stores de salas y jugadores.
  - Crear adaptadores para reloj, barajado y scheduler.
  - Centralizar creacion, cancelacion y reemplazo de timers.
  - Colocar implementaciones concretas bajo `infrastructure/` por capacidad operativa, no por framework o patron generico.
  - Definir ownership y cleanup de recursos.
  - Permitir tests deterministas con adaptadores fake.

  Actualizacion del contexto del proyecto:
  - Registrar en `architecture.md` puertos, adaptadores, ownership de efectos y reglas de cleanup.
  - Actualizar `domain.md` solo si se descubre una decision funcional, no con detalles tecnicos.
  - Mantener `AGENTS.md` como indice hacia adaptadores y comandos.
  - Automatizar los limites tecnicos desde tooling local del repo.

  Restricciones:
  - No anadir base de datos.
  - No cambiar balance ni reglas.
  - No esconder efectos en funciones aparentemente puras.
  - No especializar comandos SDD.

  Validacion:
  - Domain y application no dependen de infraestructura concreta.
  - Los tests controlan reloj, random y scheduler.
  - No quedan timers huerfanos en los flujos cubiertos.
  - Los checks automatizados permiten `infrastructure -> application` y rechazan imports de infraestructura desde application/domain.
status: implemented
spec: .harness/specs/2026-07-23/c4e8a1f2-encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory.md
design: .harness/designs/2026-07-23/c4e8a1f2-encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory.md
task_number: 01
task_count: 02
---

# Objetivo

Encapsular de extremo a extremo el estado in-memory, el reloj y el azar detras de los puertos aprobados, componer una instancia compartida de cada capacidad y automatizar las fronteras de las cuatro capas sin cambiar reglas ni contratos observables.

# Alcance y evidencia

- Aplican `CA-01`, `CA-02`, `CA-04`, `CA-05`, `CA-06` y la parte de estado/runtime de `CA-07` de la SPEC.
- Mantener un unico `RoomRepository` para el agregado sala y su indice secundario de jugadores; `SessionRegistry` conserva exclusivamente los bindings de transporte.
- Completar `InMemoryRoomRepository` bajo `infrastructure/memory/` y los adaptadores de reloj y azar, reales y deterministas, bajo `infrastructure/runtime/`; no crear `PlayerRepository` ni carpetas genericas.
- Cablear en `apps/backend/src/index.ts` una sola instancia de `Clock` y `RandomSource` por runtime para casos de uso, presenter, publisher, resync y scheduler, conservando `ServerStartOptions.random` como compatibilidad de test.
- La evidencia actual muestra indices stale en `infrastructure/memory/inMemoryRoomRepository.ts:17-23`, closures directas de `Date.now`/random en `index.ts:84-178`, `Date.now` en `transport/socket/registerRoomHandlers.ts:100`, y una lectura no inyectada del lock en `transport/socket/roomPresenter.ts:55`.
- Extender `tooling/layerBoundaries.ts`, sus fixtures y el gate de cobertura existente; `apps/backend/package.json` ya integra `check:layers` mediante el alias compatible `check:domain` antes de test, cobertura y build.

# Criterios de aceptacion

- **CA-01 / CA-02:** `RoomRepository` guarda sala, jugadores y version de forma atomica solo en memoria, devuelve copias, detecta conflicto de version y mantiene `findRoomCodeByPlayer` correcto tras reemplazo, movimiento, expulsion, borrado y `clear`, sin persistencia ni store de jugador independiente.
- **CA-02 / CA-05:** produccion usa los adaptadores de sistema; `ManualClock` permite fijar y avanzar el instante y `SequenceRandomSource` valida cada valor, conserva orden y expone el numero de lecturas para reproducir codigos, Fisher-Yates, reparto y deadlines sin globals reales.
- **CA-01 / CA-02:** `index.ts` compone un reloj y un random compartidos y los inyecta en aplicacion, scheduler y transporte; resync, envelopes y acciones privadas usan el mismo instante correspondiente, mientras host, puerto, `timingScale`, health y exports de lifecycle permanecen compatibles.
- **CA-04:** `gameTiming.ts` recibe `now` de forma obligatoria en caminos productivos y ni `domain/` ni `application/` usan `Date.now`, `Math.random` o primitivas de timer; las transformaciones de mazo y decisiones funcionales permanecen en aplicacion/dominio.
- **CA-06:** el checker AST clasifica `domain`, `application`, `infrastructure` y `transport`, permite `infrastructure -> application/ports`, rechaza `application -> infrastructure`, `domain -> infrastructure`, aristas inversas de transporte, imports dinamicos no literales y globals operativos en las capas logicas.
- **CA-01 / CA-07:** acks, eventos, payloads, privacidad, versiones y orden Socket.IO no cambian; `architecture.md` documenta los puertos y adaptadores realmente materializados sin trasladar detalles tecnicos a `domain.md`.

# Tareas de implementacion

- **TI-01 — Caracterizar el baseline observable:** fijar con tests los codigos, numero y orden de lecturas random, reparto, deadlines, `serverTime`, locks, acks, snapshots, privacidad y versiones antes de sustituir las dependencias operativas.
- **TI-02 — Cerrar el repositorio in-memory:** reindexar atomicamente cada `save` retirando solo asociaciones antiguas que aun apunten a la sala reemplazada, indexar la nueva copia y garantizar cleanup coherente en `delete` y `clear`; probar clones, conflictos, remove/kick, movimiento entre salas y ausencia de indices stale.
- **TI-03 — Implementar adaptadores runtime deterministas:** conservar `SystemClock`/`SystemRandomSource` como unicos propietarios productivos de los globals y anadir `ManualClock`/`SequenceRandomSource` co-localizados por capacidad, con validaciones e inspeccion acordadas.
- **TI-04 — Componer reloj y azar una sola vez:** sustituir closures y llamadas directas en `index.ts`, presenter, publisher, resync y timing por los puertos compartidos; conservar la opcion `random` del servidor mediante composicion y asegurar una lectura temporal coherente por envelope.
- **TI-05 — Automatizar fronteras y cobertura:** ampliar clasificacion, matriz de imports y globals del checker con fixtures positivos/negativos y arbol real; incluir la nueva logica medible de memoria/runtime en el gate `>= 80%` sin anadir dependencia de linting ni cambiar scripts publicos.
- **TI-06 — Documentar y auditar el slice:** actualizar `architecture.md` con repositorio, indice, reloj, random, direccion de dependencias y ubicaciones por capacidad; confirmar por busqueda que las capas logicas no importan infraestructura ni usan globals prohibidos.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar `docker compose run --build --rm --no-deps backend npm run check:layers`, `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Exigir `>= 80%` en lineas, branches y funciones sobre la logica medible nueva o modificada de aplicacion, repositorio y adaptadores runtime; no reducir la linea base observada de 98.23%/85.83%/97.49% para dominio/aplicacion.
- Ejecutar tests unitarios sin red para clones, version e indices, reloj manual, secuencia random, codigo/reparto/deadlines y fixtures AST; ejecutar las regresiones Socket.IO de create, join, leave, reconnect, resync, start y snapshots.
- Comparar literalmente acks, nombres/orden de eventos, versiones, `serverTime`, estado publico/privado y ausencia de mano o `socketId` en broadcasts; confirmar que no se agregaron dependencias ni configuracion de persistencia.

# Documentacion aplicable

- Actualizar `.harness/context/architecture.md` con `RoomRepository`, implementaciones de memoria/runtime, composicion compartida de reloj/random, direccion de las cuatro capas, checker y alcance del gate de cobertura.
- No modificar `.harness/context/domain.md`: este slice no introduce ninguna decision funcional y no debe registrar puertos, adaptadores, globals ni detalles de indices.
- Posponer la actualizacion indice de `AGENTS.md` hasta el cierre de TASK 02, cuando tambien exista el ownership final del scheduler; no modificar README porque se conservan los comandos.

# Riesgos y restricciones

- Mitigar indices stale limpiando solo asociaciones cuyo valor siga siendo la sala reemplazada y cubriendo movimiento, expulsion, sala no vacia, delete y clear.
- Mitigar deriva temporal usando la instancia compartida y una lectura coherente por envelope; mitigar deriva del fake random validando rango, consumo y agotamiento contra escenarios productivos.
- No anadir base de datos, IO, serializacion externa, nuevas dependencias, reglas, balance, contratos realtime, frontend, `packages/contracts/`, Docker/Render ni carpetas genericas `services`, `adapters` o `utils`.
- No esconder barajado o decisiones en infraestructura, no especializar comandos SDD y no editar `AGENTS.md` con contratos incompletos.
