---
id: c4e8a1f2
slug: encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory
type: design
created_at: 2026-07-23T08:50:25Z
created_by_command: /sdd:design
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
status: approved
spec: .harness/specs/2026-07-23/c4e8a1f2-encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory.md
approved_at: 2026-07-23T08:55:50Z
approved_by: user
---

# Diseno propuesto

La migracion se completara de forma incremental sobre las capas existentes, sin cambiar los tipos wire, las reglas de dominio ni la semantica observable de salas y partidas. `apps/backend/src/index.ts` seguira siendo el composition root; `application/` declarara las capacidades que necesita y los efectos diferidos que desea materializar; `infrastructure/` poseera el estado de proceso, el reloj, el azar y los recursos temporizados; `transport/socket/` continuara limitado a validacion, sesion, presentacion y publicacion.

## D-01 — Un repositorio conserva el agregado sala y su indice de jugadores

- **Pregunta:** ¿Los jugadores requieren un store independiente del store de salas?
- **Decision:** Mantener un unico puerto `RoomRepository` en `apps/backend/src/application/ports/roomRepository.ts`. El agregado `ApplicationRoom` contiene los jugadores y el puerto expone `findRoomCodeByPlayer(playerId)` como indice secundario; no se creara un `PlayerRepository` que permita escrituras independientes.
- **Motivo:** Sala, host, presencia, manos, version y partida se guardan de forma atomica. Separar escrituras de jugador permitiria estados parciales y no aporta persistencia ni una frontera operativa distinta dentro del alcance aprobado.
- **Impacto:** `InMemoryRoomRepository` seguira bajo `infrastructure/memory/`, devolvera copias y comprobara `expectedVersion`. Cada `save` retirara del indice los jugadores de la version reemplazada antes de indexar los de la nueva version; `delete` y `clear` limpiaran ambos mapas. `SessionRegistry` seguira siendo un registro exclusivo de transporte para `socketId -> playerId -> roomCode`, no un repositorio funcional.

## D-02 — Los puertos se declaran en aplicacion y las implementaciones se agrupan por capacidad

- **Pregunta:** ¿Donde viven los contratos y adaptadores de estado, tiempo, azar y planificacion?
- **Decision:** Conservar las declaraciones `RoomRepository`, `Clock`, `RandomSource`, `Scheduler` y `ApplicationEventPublisher` bajo `apps/backend/src/application/ports/`. Las implementaciones concretas viviran en `infrastructure/memory/`, `infrastructure/runtime/` e `infrastructure/scheduling/`; no se introduciran carpetas genericas `services/`, `adapters/` o `utils/`.
- **Motivo:** La aplicacion define las capacidades requeridas y la infraestructura depende hacia dentro para implementarlas. La organizacion por capacidad hace visible quien posee `Map`, `Date.now`, `Math.random` y las primitivas de timers.
- **Impacto:** `domain/` no conocera puertos ni infraestructura. `application/` solo importara dominio y sus propios puertos. `infrastructure/` podra importar tipos de `application/ports/`; `index.ts` instanciara y conectara implementaciones concretas.

## D-03 — RandomSource es el limite de azar y el barajado permanece como decision reproducible

- **Pregunta:** ¿El puerto debe entregar un mazo ya barajado o una secuencia de azar?
- **Decision:** Usar `RandomSource.next(): number` como puerto minimo. El Fisher-Yates de `GameUseCases` seguira construyendo el mazo con esa secuencia y el dominio seguira recibiendo el mazo resultante; la infraestructura no decidira cartas, reparto ni balance.
- **Motivo:** El algoritmo actual forma parte de la reproduccion del comportamiento y solo necesita una fuente no determinista. Mover el barajado completo a infraestructura ocultaria una transformacion relevante y ampliaria el contrato sin necesidad.
- **Impacto:** Produccion usara una implementacion de `RandomSource` respaldada por `Math.random`; pruebas e integracion podran suministrar una secuencia o funcion sembrada. La generacion de codigos de sala y el barajado consumiran el mismo limite configurado, manteniendo `ServerStartOptions.random` como compatibilidad de test.

## D-04 — Un dispatcher materializa todas las directivas de trabajo diferido

- **Pregunta:** ¿Quien crea, reemplaza y cancela trabajo temporizado?
- **Decision:** Los casos de uso declararan, junto a sus eventos, directivas explicitas `replace`, `cancel` o `cancel-room`. `dispatchApplicationResult` sera el unico materializador de esas directivas: primero aplicara cancelaciones declaradas sobre el estado ya comprometido, despues publicara los eventos en el orden actual y finalmente registrara los reemplazos. Ninguna funcion de dominio ni helper aparentemente puro invocara el scheduler.
- **Motivo:** Actualmente el dispatcher programa efectos, mientras `RoomUseCases` cancela por sala y `StarUseCases` cancela `cpu-turn` directamente. Expresar las tres operaciones como datos concentra el efecto y permite observarlo sin timers reales.
- **Impacto:** La identidad estable sera `{ roomCode, trigger }`, ya presente en `ApplicationEffect`; `replace` cancelara cualquier trabajo anterior de esa identidad antes de registrar el nuevo. El borrado de la ultima persona declarara `cancel-room`; `retry` declarara `cancel-room` antes de su nuevo `dealing-expired`; el cierre de consenso de estrella declarara `cancel` para `cpu-turn`. Se mantendran los triggers actuales: `dealing-expired`, `countdown-expired`, `error-expired`, `round-flip-expired`, `round-unflip-expired`, `next-level-expired`, `level-ready-expired`, `cpu-turn` y `star-settled`.

## D-05 — Scheduler posee el recurso completo y la aplicacion conserva la guarda stale

- **Pregunta:** ¿Como se evita que cancelacion, reemplazo, retry o shutdown dejen callbacks capaces de actuar?
- **Decision:** `ProcessScheduler` sera el unico propietario de handles de timeout y de cualquier entrega diferida necesaria para conservar el orden del turno de ack. Cada entrada conservara clave y generacion; la entrega comprobara que sigue siendo la entrada activa antes de invocar `run`, y se retirara exactamente una vez. El puerto expondra cancelacion por clave, por sala y global; la implementacion concreta cancelara tanto espera como entrega pendiente.
- **Motivo:** Cancelar solo el timeout no cubre una entrega ya pasada a `setImmediate`. La generacion evita que una entrega reemplazada ejecute el callback del trabajo anterior. La cancelacion global permite cerrar el proceso aunque el repositorio ya no enumere todas las salas.
- **Impacto:** `resetServerForTests` y `stopServer` cancelaran globalmente el scheduler antes de limpiar repositorio y sesiones o cerrar Socket.IO. El borrado de sala y retry aplicaran cleanup por sala. Como defensa ante una carrera ya iniciada, `EffectUseCases.materialize` mantendra las guardas de sala existente, `expectedVersion`, fase, lock, deadline y vencimiento; un rechazo stale no guardara ni publicara. La primitiva Node de timers quedara encapsulada dentro de `infrastructure/scheduling/` y sera inyectable a nivel de infraestructura para probar carreras sin tiempo real.

## D-06 — Produccion y pruebas usan adaptadores explicitos y el mismo reloj por composicion

- **Pregunta:** ¿Como se controlan reloj, azar y scheduler sin cambiar APIs funcionales?
- **Decision:** `index.ts` creara una instancia de reloj y una de random por runtime, y las inyectara en casos de uso, scheduler, presenter, publisher y resync. Produccion usara los adaptadores de sistema; las pruebas usaran `ManualClock`, `SequenceRandomSource` y `DeterministicScheduler`, co-localizados bajo las carpetas de su capacidad operativa.
- **Motivo:** En el estado actual los puertos existen, pero `index.ts`, `registerRoomHandlers.ts`, `RoomPresenter` y el scheduler aun construyen wrappers o llaman `Date.now` directamente. Una fuente compartida elimina divergencias entre deadline, `serverTime`, acciones privadas y ejecucion del callback.
- **Impacto:** `gameTiming.ts` recibira `now` de forma obligatoria en los caminos productivos y `RoomPresenter` lo pasara a `isInteractionLockActive`. El fake de reloj permitira fijar y avanzar el instante; el fake de random consumira una secuencia validada y expondra su numero de lecturas; el fake de scheduler conservara trabajos por clave, historial de reemplazos/cancelaciones/ejecuciones, orden estable para empates y operaciones para ejecutar uno o todos los trabajos vencidos. Ningun test de aplicacion o de callbacks necesitara red, `Date.now`, `Math.random`, `setTimeout` ni esperas reales.

## D-07 — Los limites se verifican por AST y no por convencion

- **Pregunta:** ¿Que aristas y globals debe rechazar el tooling local?
- **Decision:** Extender `apps/backend/src/tooling/layerBoundaries.ts` para modelar `domain`, `application`, `infrastructure` y `transport`: `domain` no importara capas externas; `application` podra importar `domain` y `application` pero no `infrastructure` ni `transport`; `infrastructure` podra implementar puertos de `application`; `transport` podra depender de `application` y `domain` sin ser importado desde dentro. `Date.now`, `Math.random` y primitivas de timer se rechazaran en `domain/` y `application/`.
- **Motivo:** El checker actual ya rechaza varias aristas desde dominio y aplicacion, pero clasifica infraestructura y transporte como `other` y solo prohibe globals en dominio. La SPEC exige que la direccion completa sea automatica y tenga fixtures negativos.
- **Impacto:** `check:layers` y el alias `check:domain` se conservaran, asi como su ejecucion previa a test, cobertura y build. Se anadiran fixtures positivos para `infrastructure -> application/ports` y negativos para `application -> infrastructure`, `domain -> infrastructure`, imports dinamicos no literales y globals operativos en las capas logicas. No se incorporara una dependencia nueva de linting.

# Evidencia y estado actual

- La SPEC aprobada fija comportamiento exclusivamente in-memory, puertos para estado/reloj/azar/scheduler, cleanup unico, fakes deterministas y enforcement de dependencias: `.harness/specs/2026-07-23/c4e8a1f2-encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory.md` (CA-01 a CA-07).
- `apps/backend/src/application/ports/roomRepository.ts` ya declara lectura, indice por jugador, control optimista, guardado y borrado; `apps/backend/src/infrastructure/memory/inMemoryRoomRepository.ts` usa `Map` y `structuredClone`. Su `save` agrega indices actuales pero no retira los de jugadores eliminados de una sala no vacia, por lo que la reindexacion atomica debe quedar cubierta.
- `apps/backend/src/application/ports/clock.ts`, `randomSource.ts` y `scheduler.ts` ya separan capacidades. `apps/backend/src/infrastructure/runtime/systemClock.ts` y `systemRandomSource.ts` encapsulan los globals, pero `apps/backend/src/index.ts:createTransport` aun inyecta closures con `Date.now` y la variable global `random` en vez de componer esos adaptadores.
- `apps/backend/src/infrastructure/scheduling/processScheduler.ts:ProcessScheduler` reemplaza por `${roomCode}:${key}`, cancela por clave y por sala y retira el timeout antes de ejecutar. La entrega posterior por `setImmediate` no queda registrada, por lo que cancelacion global y guarda de generacion son necesarias para ownership completo.
- `apps/backend/src/application/dispatcher.ts:dispatchApplicationResult` es el materializador de publicaciones y schedules. `RoomUseCases.remove` cancela una sala directamente y `StarUseCases.execute` cancela `cpu-turn` directamente; esas dos excepciones motivan las directivas explicitas de D-04.
- `apps/backend/src/application/effectUseCases.ts:EffectUseCases.materialize` ya rechaza sala ausente y version stale antes de guardar. Las funciones de dominio vuelven a validar fase, lock y deadline, proporcionando la segunda barrera requerida para callbacks tardios.
- `apps/backend/src/index.ts:resetServerForTests` recorre los codigos aun presentes para cancelar por sala y luego limpia repositorio/sesiones; `stopServer` delega en ese flujo. No existe una operacion global en el puerto y `clearRoomTimers` es actualmente un no-op.
- `apps/backend/src/transport/socket/sessionRegistry.ts:SessionRegistry` posee exclusivamente los bindings activos de sockets y protege contra disconnects stale; no contiene estado funcional de jugadores.
- `apps/backend/src/tooling/layerBoundaries.ts` inspecciona imports estaticos/dinamicos por AST y prohibe infraestructura desde `application`, pero solo clasifica `domain`, `application` y `other`. `apps/backend/src/tooling/layerBoundaries.test.ts` ya valida el grafo real y algunas aristas negativas.
- `apps/backend/package.json` descubre tests recursivamente mediante `tooling/testFiles.ts`, ejecuta `check:layers` antes de `test`, `test:coverage` y `build`, y aplica un gate de 80% a la logica de dominio/aplicacion mediante `domainCoverageReporter.mjs`.
- Evidencia ejecutada el 2026-07-23: `npm run check:layers` paso; `npm test` paso 95/95; `npm run test:coverage` paso con 98.23% de lineas, 85.83% de branches y 97.49% de funciones en la capa logica. `npm run build` no pudo escribir varios artefactos existentes de `apps/backend/dist/` por `EACCES`; el chequeo de capas previo si paso, pero la compilacion debe repetirse con el comando canonico en contenedor durante la implementacion.

# Cambios e impacto

- **Dominio:** Ningun cambio de reglas, balance, poblaciones, fases, resultados ni contratos. Los efectos seguiran siendo datos con trigger, `dueAt` y expectativas stale; no se introduciran puertos ni infraestructura en `domain/`.
- **Aplicacion:** Se formalizaran directivas de trabajo diferido en los resultados y su materializacion unica en `dispatcher.ts`; los casos de uso dejaran de invocar cancelaciones concretas. Los puertos conservaran operaciones pequenas y sincronas, compatibles con el proceso in-memory.
- **Infraestructura de memoria:** `InMemoryRoomRepository` mantendra sala e indice de jugadores de forma coherente en save/delete/clear, sin base de datos, IO ni serializacion externa.
- **Infraestructura runtime:** Reloj y random reales quedaran como las unicas implementaciones productivas de globals; los equivalentes manual/secuencial permitiran pruebas repetibles.
- **Infraestructura de scheduling:** `ProcessScheduler` poseera espera, entrega, reemplazo, cancelacion por clave/sala/global y shutdown. Un runtime de timers interno e inyectable permitira probar su lifecycle sin filtrar primitivas Node a aplicacion.
- **Composition root y lifecycle:** `index.ts` cableara una sola instancia de cada capacidad y realizara cleanup antes de limpiar estado o cerrar transporte. Se conservaran host/puerto, `timingScale`, RNG inyectable, endpoint health y exports de lifecycle.
- **Transporte:** `RoomPresenter`, `SocketEventPublisher` y `registerRoomHandlers` recibiran el reloj compuesto. No cambiaran nombres de eventos, payloads, acks, privacidad, versiones ni orden observable.
- **Tooling:** El checker cubrira las cuatro capas y globals operativos; los scripts existentes seguiran siendo la entrada local. El gate de cobertura incluira la logica medible nueva de repositorio, runtime y scheduler, manteniendo umbral de lineas, branches y funciones `>= 80%`.
- **Frontend y contracts:** Ninguno. No se modificaran `apps/frontend/` ni `packages/contracts/` porque la migracion es interna al backend.
- **Dependencias y despliegue:** Ninguna dependencia nueva ni cambio de Docker/Render. El estado desaparecera al reiniciar el proceso igual que ahora.

# Riesgos tecnicos

- **Orden de efectos:** Mover cancelaciones al dispatcher puede alterar publicaciones si se mezcla su orden. Mitigacion: commit existente, cancelaciones, eventos en el orden actual y reemplazos, con tests exactos del orden Socket.IO.
- **Carrera al vencer:** Un timeout puede vencer mientras se reemplaza o cancela. Mitigacion: identidad/generacion en infraestructura, cancelacion de espera y entrega, y guardas de version/fase/lock/deadline antes de cualquier save o publish.
- **Cleanup excesivo en retry:** Cancelar por sala tambien elimina trabajos validos de la partida anterior. Es intencional en retry, pero el nuevo `dealing-expired` debe programarse despues de la cancelacion; una prueba verificara exactamente ese orden.
- **Deriva entre fake y produccion:** Un fake demasiado permisivo podria ocultar errores de reemplazo. Mitigacion: ambos adaptadores deben compartir el contrato de clave, reemplazo y cleanup, y existir pruebas de conformidad con los mismos escenarios.
- **Indice secundario stale:** Reindexar incorrectamente podria desvincular un jugador que ya pertenece a otra sala. Mitigacion: limpiar solo las asociaciones cuyo valor siga siendo la sala reemplazada y probar movimiento, expulsion, sala no vacia, borrado y clear.
- **Reloj compartido y presentacion:** Sustituir llamadas directas puede cambiar milisegundos de `serverTime` o evaluacion de lock. Mitigacion: usar una lectura compartida por envelope como actualmente y caracterizar los snapshots/versiones con integracion Socket.IO.
- **Build local:** Los artefactos `dist/` presentan permisos incompatibles en el host actual. Mitigacion: validar con los comandos Docker canonicos, que construyen en un filesystem limpio, sin cambiar el alcance funcional.

# Estrategia de testing

- Caracterizar primero la linea base de `RoomUseCases`, `GameUseCases`, `StarUseCases`, `EffectUseCases`, presenter, publisher y Socket.IO; conservar literalmente acks, eventos, privacidad, versiones y orden de emision.
- Probar `InMemoryRoomRepository` con clones aislados, conflicto de version, reindexacion tras remove/kick, movimiento entre salas, `delete`, `clear` y ausencia de indices stale.
- Ejecutar casos de uso con `ManualClock` y `SequenceRandomSource`: codigo de sala reproducible, numero/orden de lecturas, reparto reproducible, deadlines exactos y rechazo de valores random fuera de rango.
- Aplicar una suite de conformidad a `DeterministicScheduler` y `ProcessScheduler`: replace por `{roomCode, trigger}`, cancelacion individual, cancelacion por sala, cancelacion global, orden estable de vencimientos, ejecucion unica y cancelacion durante la ventana previa a entrega.
- Cubrir con scheduler fake todos los triggers existentes. Despues de cada flujo se afirmara `pendingJobs.length === 0` cuando corresponda: expiracion normal, estrella por todos los acks, estrella por deadline, cancel/reject, retry, borrado de ultima persona, desconexion cubierta, reset y stop.
- Verificar que un callback antiguo por version, retry, lock/deadline reemplazado o sala eliminada retorna rechazo y no cambia repositorio, no publica y no registra trabajo nuevo.
- Ampliar fixtures del checker con aristas positivas y negativas de las cuatro capas, imports dinamicos y globals; ejecutar el checker sobre el arbol real.
- Mantener cobertura medible `>= 80%` en lineas, branches y funciones e incluir la nueva logica de infraestructura en el gate. Objetivo de regresion: no descender de la linea base observada de 98.23%/85.83%/97.49% para dominio y aplicacion.
- Validacion final canonica: `docker compose run --build --rm --no-deps backend npm run check:layers`, `npm test`, `npm run test:coverage` y `npm run build` dentro del servicio backend. Ejecutar tambien test, cobertura y build de frontend para confirmar que los contratos compartidos no cambiaron.

# Estrategia de documentacion

- Actualizar `.harness/context/architecture.md` con el inventario final de puertos, implementaciones por capacidad, direccion de dependencias, clave estable de trabajo, orden del dispatcher, ownership de timeout/entrega y matriz de cleanup para replace, expiry, retry, delete, reset y stop.
- Mantener `.harness/context/domain.md` sin detalles de puertos, adapters o timers. Solo se modificaria si la implementacion revelara una decision funcional; con la evidencia actual no se ha descubierto ninguna.
- Actualizar `AGENTS.md` unicamente como indice hacia `application/ports/`, las capacidades bajo `infrastructure/`, el checker y los comandos canonicos; no duplicar contratos tecnicos extensos.
- Ajustar `README.md` solo si la lista de comandos observables cambia. La propuesta conserva `check:layers`, su alias y los comandos existentes, por lo que no se prevé cambio.
- No modificar `.opencode/commands/` ni especializar el flujo SDD.

# Gaps resueltos

- El estado de jugadores no se separa del agregado sala; el lookup inverso pertenece al mismo repositorio y las sesiones socket permanecen en transporte.
- El limite de barajado sera `RandomSource`, manteniendo Fisher-Yates en aplicacion y evitando que infraestructura decida cartas.
- La identidad de reemplazo sera `{ roomCode, trigger }`; retry cancela toda la sala antes de registrar el nuevo trabajo y estrella cancela especificamente `cpu-turn`.
- El scheduler poseera tambien la entrega diferida posterior al timeout y ofrecera cleanup global para lifecycle de servidor.
- Los fakes se co-localizaran por capacidad operativa y expondran inspeccion de lecturas, trabajos, reemplazos, cancelaciones y ejecuciones.
- No se requiere ninguna decision funcional ni cambio de contrato realtime, frontend, persistencia, balance o comandos SDD.

# Decision humana

Aprobar. La persona usuaria respondio exactamente `Aprobar` al gate pendiente; el DESIGN queda aprobado sin cambios adicionales a la propuesta tecnica.
