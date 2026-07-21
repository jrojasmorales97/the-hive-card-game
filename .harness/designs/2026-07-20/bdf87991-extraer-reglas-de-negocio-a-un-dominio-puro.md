---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: design
created_at: 2026-07-20T17:42:38Z
created_by_command: /sdd:design
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
status: approved
spec: .harness/specs/2026-07-20/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro.md
approved_at: 2026-07-21T17:38:03Z
approved_by: user
---

# Diseno propuesto

Se introducira un limite logico de dominio en `apps/backend/src/domain/`, complementado por la maquina de estados canonica que permanece en `apps/backend/src/gameStateMachine.ts`. El dominio recibira snapshots y dependencias deterministas, devolvera un nuevo estado junto con eventos y efectos declarativos, y no conocera salas Socket.IO, sockets, versiones wire, logs, timers reales ni variables de entorno.

La estructura objetivo es:

```text
apps/backend/src/
  domain/
    model.ts          # partida, jugador, juego, mano, pila, recursos y consenso
    result.ts         # DomainResult, DomainEvent y DomainEffect discriminados
    participants.ts   # poblaciones nombradas de ready/play/pause/consensus/settlement
    setup.ts          # balance, recompensas, inicio, retry y reparto
    round.ts          # ready, pausa, countdown y resolucion de ronda
    cards.ts          # juego, penalizacion, descartes y resultado posterior
    star.ts           # propuesta, votos, consumo y settlement
    progression.ts    # nivel, recompensas, derrota y victoria
    scoring.ts        # ranking final
  gameStateMachine.ts # autorizacion canonica de fase, actor, lock y expiracion
  domainAdapter.ts    # conversion Room <-> DomainMatch y aplicacion atomica del resultado
  starAnimation.ts    # espera de acks de UI; infraestructura, no regla de descarte
  index.ts            # transporte, registros en memoria, serializacion, emisiones y scheduler
```

`DomainMatch` contendra `status`, `hostId`, `players` y `game`; `DomainPlayer` contendra identidad funcional, presencia, ready, mano e indicador CPU; `DomainGame` contendra fase, nivel, recursos, pila, historial, propuesta de estrella, lock, inicio, errores y resultados. `socketId`, `code`, `version`, `logs` y los Maps/timers de proceso permaneceran en la aplicacion. `domainAdapter.ts` copiara solo datos funcionales hacia el dominio y fusionara el estado resultante conservando metadata de transporte.

Cada operacion expondra un resultado discriminado:

```ts
type DomainResult =
  | { ok: false; error: string }
  | {
      ok: true;
      state: DomainMatch;
      events: DomainEvent[];
      effects: DomainEffect[];
    };
```

Los eventos representaran hechos ya decididos, por ejemplo carta jugada, penalizacion, descarte, pausa, estrella propuesta/aceptada/usada, nivel completado, recompensa, derrota, victoria y reinicio. Los efectos temporales solo declararan `trigger`, `dueAt` y el estado esperado (`phase`, `lockReason`, `lockUntil`); `index.ts` sera el unico encargado de materializarlos con `setTimeout`. Al vencer un efecto, el shell enviara un comando temporal al dominio con ese estado esperado y la maquina canonica rechazara callbacks obsoletos. El adaptador traducira eventos a los payloads, acks y logs actuales sin recalcular reglas.

La migracion se realizara en estados estables, sin flags ni doble escritura:

1. **Fundacion y caracterizacion:** crear modelo, resultados, adaptador, checker de limites e inventario de propietarios; ampliar tests de caracterizacion antes de mover una regla.
2. **Participantes y autorizacion:** consolidar las poblaciones nombradas en la maquina canonica y `domain/participants.ts`; retirar los predicados duplicados de `roundParticipants.ts` al cambiar todos sus consumidores.
3. **Setup y ciclo de ronda:** migrar balance, mapa de recompensas, reparto, inicio/retry, ready, pausa y countdown; eliminar las ramas equivalentes de `startGameInRoom`, `game:retry`, `dealLevel`, `applyRoundReadyRequest` y `pauseRoundForReady` cuando los handlers consuman el resultado de dominio.
4. **Cartas y penalizacion:** migrar validacion, jugada, historial, cartas bloqueantes, vida, errores, descartes y resolucion posterior; reemplazar atomicamente `playCardInRoom`, `resolveErrorAndDiscard`, `discardLowerCards` y los calculos de outcome.
5. **Estrella:** migrar propuesta, aceptacion idempotente, cancelacion, rechazo, consumo y preview/settlement; mantener fuera solo la espera de acks visuales y retirar las decisiones equivalentes de `index.ts`, `gameTiming.ts` y `starResolution.ts`.
6. **Progresion y final:** migrar recompensas, topes, avance, terminales y scoring; reemplazar `completeLevelOrGame`, `applyLevelReward`, `dealLevel` y `finalizeGameResults`; mover el calculo de `finalScoring.ts` a `domain/scoring.ts`.
7. **Cierre:** eliminar helpers vacios o reexports transitorios, ejecutar busquedas de propietarios antiguos y actualizar contexto/documentacion contra el codigo final.

En cada slice se conservara primero el escenario Socket.IO que caracteriza el comportamiento, se conectara un solo consumidor al nuevo propietario y se borrara la implementacion anterior en el mismo cambio. Los adaptadores podran mantener nombres de payload existentes, pero no funciones que vuelvan a decidir elegibilidad, penalizaciones, recursos, progreso o terminales.

## D-01 — Limite fisico y logico del dominio

- **Pregunta:** Como aislar las reglas sin forzar que transporte y metadata de sala formen parte del modelo?
- **Decision:** Usar `apps/backend/src/domain/` para estado y operaciones puras, `domainAdapter.ts` para mapear el `Room` en memoria y considerar `gameStateMachine.ts` parte del limite logico aunque conserve su ruta canonica.
- **Motivo:** Mantiene la ruta y API autoritativa ya probadas, permite migracion incremental y evita introducir `socketId`, versiones o logs en las reglas.
- **Impacto:** El checker inspeccionara tanto `src/domain/**` como `src/gameStateMachine.ts`; `index.ts` conservara solo estado de proceso y orquestacion.

## D-02 — Modelo funcional separado del wire

- **Pregunta:** Debe el dominio reutilizar tipos de `@the-hive/contracts`?
- **Decision:** Definir tipos funcionales propios en `domain/model.ts`; el adaptador y los serializers comprobaran compatibilidad estructural con los contratos wire.
- **Motivo:** `packages/contracts/` es la fuente de contratos de transporte, mientras el dominio no debe depender del transporte ni convertir esos DTO en su modelo interno.
- **Impacto:** `gameStateMachine.ts` importara vocabulario funcional desde `domain/model.ts`; no se modificaran payloads ni exports publicos de contracts por esta extraccion.

## D-03 — Resultado explicito e inmutable

- **Pregunta:** Como impedir mutaciones parciales y recalculos en el shell?
- **Decision:** Las operaciones no mutaran su entrada y devolveran `DomainResult` con estado completo, eventos de dominio y efectos declarativos.
- **Motivo:** Hace determinista cada prueba, permite aplicar el resultado una sola vez y entrega al exterior toda la informacion necesaria.
- **Impacto:** El adaptador aplicara el nuevo estado de forma atomica y emitira a partir de eventos; un resultado rechazado no alterara sala, version ni timers.

## D-04 — Autoridad unica de fases

- **Pregunta:** Donde se autorizan fase, actor, lock y expiraciones durante la extraccion?
- **Decision:** Toda operacion invocara `evaluateGameTransition()` antes de decidir; las poblaciones nombradas y validaciones temporales tendran una sola definicion compartida por comandos y capacidades privadas.
- **Motivo:** Evita autorizaciones paralelas entre handlers, `roundParticipants.ts`, `privateState.ts` y la maquina.
- **Impacto:** `buildPrivateActions()` seguira siendo una proyeccion, pero su `enabled/reason` procedera de `commandDecision()`; los callbacks incluiran expectativas para detectar staleness.

## D-05 — Reloj, azar y tiempos inyectados

- **Pregunta:** Como conservar reparto y locks sin `Date.now()`, `Math.random()` ni timers dentro del dominio?
- **Decision:** Pasar `now`, un mazo ya barajado o una funcion RNG inyectada y una politica de duraciones como datos de entrada; devolver deadlines, nunca programar timers.
- **Motivo:** Las mismas entradas produciran el mismo estado y eventos y los tests no dependeran del reloj del proceso.
- **Impacto:** `startServer()` conservara los defaults productivos actuales; el shell construira dependencias por comando y el modo test seguira usando RNG y escala controlados.

## D-06 — Estrella en dos responsabilidades

- **Pregunta:** El cierre por ack de animacion pertenece a la regla de estrella?
- **Decision:** El dominio decide consenso, consumo y cartas a descartar; `starAnimation.ts` espera los acks de sockets y dispara el comando determinista de settlement o su expiracion.
- **Motivo:** La poblacion de settlement es negocio, pero conocer `socketId` y confirmaciones de UI es infraestructura.
- **Impacto:** Desconexion y timeout mantienen el comportamiento observable; solo el dominio puede aplicar el descarte y consumir la estrella, exactamente una vez.

## D-07 — Guardia automatica de limites

- **Pregunta:** Como hacer comprobables los imports y globales prohibidos sin una nueva dependencia de lint?
- **Decision:** Crear `src/domainBoundaries.ts` usando la API AST de TypeScript ya instalada; inspeccionara `src/domain/**` y `src/gameStateMachine.ts`, y tendra comando `npm run check:domain` integrado antes de `test`, `test:coverage` y `build`.
- **Motivo:** Un parser AST evita falsos negativos de regex y no agrega stack ceremonial.
- **Impacto:** Fallara ante imports de Fastify, Socket.IO, `@fastify/*`, `node:*`, `index.ts`, frontend o infraestructura, y ante uso de `process`, `Date.now`, `Math.random`, `setTimeout`, `setInterval` y sus clear equivalentes dentro del limite.

## D-08 — Umbral de cobertura del dominio

- **Pregunta:** Como verificar el minimo de cobertura con el runner actual de Node 20?
- **Decision:** Mantener `node:test`, incluir solo archivos productivos del limite en el calculo de dominio y agregar un reporter/gate pequeno que consuma `test:coverage` y falle por debajo de 80% en lineas, branches o funciones.
- **Motivo:** Node 20 expone includes/excludes y el evento `test:coverage`, pero el manifest actual no aplica umbrales.
- **Impacto:** `npm run test:coverage` mostrara cobertura global y aplicara el gate del dominio; no se introduce Jest, Vitest ni otra dependencia.

## D-09 — Compatibilidad exterior por adaptacion

- **Pregunta:** Como evitar que la extraccion cambie acks, eventos, privacidad o versionado?
- **Decision:** Mantener parsers y mapas de `@the-hive/contracts`, serializers y orden de emisiones en el shell; caracterizar cada slice con Socket.IO real antes de sustituirlo.
- **Motivo:** El cambio es interno y la SPEC exige conservar el comportamiento externo.
- **Impacto:** Frontend y contratos no requieren cambios funcionales; `serializeRoom()`, `buildPrivateState()`, envelopes y `emitRoomUpdate()` permanecen como frontera de privacidad/versionado.

# Evidencia y estado actual

- `apps/backend/src/index.ts:61-113` define `Player`, `GameState` y `Room` junto a metadata funcional, sockets, version y logs; `rooms`, `playerRoom`, timers, RNG y escala viven en `index.ts:115-127`.
- `apps/backend/src/index.ts:130-138`, `339-360`, `551-589`, `643-717` y `749-846` concentran balance, recompensas, mazo, setup, reparto, progresion, cartas, penalizacion y resolucion junto con reloj, emisiones y timers.
- `apps/backend/src/index.ts:895-998` mezcla consenso/consumo/descarte de estrella con `setTimeout`, sockets y acks de animacion; esta mezcla justifica separar regla y coordinacion visual.
- `apps/backend/src/gameStateMachine.ts:evaluateGameTransition` ya es pura y autoriza start/retry, ready, play, pausa, estrella y expiraciones; `TransitionDecision` ya contempla efectos declarativos, aunque los retornos actuales dejan `effects` vacio.
- Las poblaciones estan duplicadas entre `gameStateMachine.ts:readyParticipants/playParticipants/consensusParticipants/settlementParticipants` y `roundParticipants.ts:isReadyParticipant/isPlayParticipant/isPauseParticipant/isConsensusParticipant/isStarSettlementParticipant`.
- `gameTiming.ts:discardLowerCards`, `previewLowestCardPerPlayer` y `applyStarDiscardPreview`, `roundResolution.ts:getRoundResolutionOutcome` y `finalScoring.ts:calculateFinalResults` son reglas puras parciales ya extraidas, pero aun no forman un limite unico; `gameTiming.ts` mantiene defaults con `Date.now()`.
- `privateState.ts:buildPrivateActions` ya consulta `commandDecision()` cuando recibe `machineState`, pero conserva calculos previos de visibilidad/capacidad que deben quedar solo como proyeccion.
- `packages/contracts/src/state.ts` separa mano privada de `PublicRoomState`; `index.ts:189-307` conserva esa privacidad y el envelope versionado. No hay necesidad tecnica de cambiar el contrato wire.
- `apps/backend/package.json` solo declara `dev`, `build`, `test`, `test:coverage` y `start`; no existe comprobacion de limites ni lint. TypeScript 5.8.2 ya esta disponible como devDependency para implementar el analisis AST.
- `apps/backend/Dockerfile` usa Node 20. La documentacion de Node 20 confirma `--test-coverage-include`, `--test-coverage-exclude` y el evento `test:coverage` para reporters personalizados.
- Linea base ejecutada el 2026-07-20: `docker compose run --build --rm --no-deps backend npm run test:coverage` pasa 62/62 tests con 90.66% lineas, 81.16% branches y 95.58% funciones globales; `docker compose run --build --rm --no-deps backend npm run build` tambien pasa.
- `socketIntegration.test.ts` ya caracteriza privacidad/reconexion, guardas, payload invalido, start/ready/play/pause/error, estrella, derrota/retry y victoria completa con RNG y tiempos controlados; faltan casos unitarios exhaustivos de las operaciones integradas que hoy estan privadas dentro de `index.ts`.
- `README.md:30-33` aun afirma ready previo al start, mientras `gameStateMachine.ts:96-101`, `lobbyRules.test.ts` y el contexto canonico confirman inicio manual del host con dos conectados; la estrategia documental debe corregir esta divergencia sin cambiar la regla.

# Cambios e impacto

- **Dominio backend:** se agregan el modelo y operaciones bajo `apps/backend/src/domain/`; los helpers puros existentes se mueven o absorben y sus rutas antiguas se eliminan cuando dejan de tener consumidores.
- **Maquina de estados:** `apps/backend/src/gameStateMachine.ts` conserva nombre y autoridad; amplia efectos/expectativas temporales y elimina poblaciones o checks duplicados fuera de su limite.
- **Aplicacion backend:** `apps/backend/src/index.ts` conserva Fastify, Socket.IO, Maps, lifecycle de salas/conexion, CPU, serializacion, emisiones, versionado y scheduler; los handlers pasan de decidir a parsear, invocar dominio, aplicar y traducir.
- **Adaptacion de estrella:** los acks visuales y timeouts quedan en `starAnimation.ts`; no pueden modificar manos o estrellas directamente.
- **Contratos:** `packages/contracts/` no cambia salvo que una comprobacion de compatibilidad de tipos requiera solo ajustes de import; no se agregan ni renombran eventos, payloads o acks.
- **Frontend:** no hay cambios funcionales previstos. Sus tests actuan como regresion indirecta; no se mueve logica de negocio al cliente.
- **Configuracion:** `apps/backend/package.json` incorpora `check:domain` y encadena la guarda a test, cobertura y build. Render ejecuta `npm run build`, por lo que hereda la validacion sin modificar `render.yaml`.
- **Testing:** se agregan tests co-localizados `apps/backend/src/domain/*.test.ts`, tests del checker y casos de adaptacion; los tests antiguos se mueven con su propietario o se retiran si quedan cubiertos por la nueva API.
- **Documentacion:** se actualizan `.harness/context/domain.md`, `.harness/context/architecture.md`, `AGENTS.md` y la seccion desactualizada de `README.md`; no se modifican plantillas SDD genericas.
- **Datos y despliegue:** no hay migracion de datos ni persistencia. El estado sigue en memoria y el proceso de despliegue conserva comandos y variables actuales.

Inventario de propiedad objetivo:

| Regla | Propietario actual | Propietario objetivo | Exterior permitido |
| --- | --- | --- | --- |
| Fase, actor, lock y expiracion | `gameStateMachine.ts` y guardas de `index.ts` | `gameStateMachine.ts` | scheduler entrega triggers esperados |
| Poblaciones ready/play/pause/consensus/settlement | `gameStateMachine.ts` y `roundParticipants.ts` | maquina + `domain/participants.ts` sin predicados paralelos | proyeccion de acciones |
| Balance, estrella inicial, reparto y retry | `index.ts` | `domain/setup.ts` | RNG/mazo, reloj y duraciones inyectados |
| Carta minima, error, vida y descartes | maquina, `index.ts`, `gameTiming.ts` | `domain/cards.ts` autorizado por maquina | emisiones desde eventos |
| Pausa, ready y quorum | `index.ts`, `roundParticipants.ts` | `domain/round.ts` autorizado por maquina | countdown materializado por scheduler |
| Consenso, consumo y settlement de estrella | maquina, `index.ts`, `gameTiming.ts`, `starResolution.ts` | `domain/star.ts` autorizado por maquina | acks visuales en `starAnimation.ts` |
| Recompensa, topes, nivel y terminales | `index.ts`, `roundResolution.ts`, `levelFlow.ts` | `domain/progression.ts` | delays materializados por scheduler |
| Ranking final | `index.ts`, `finalScoring.ts` | `domain/scoring.ts` | serializer wire |

# Riesgos tecnicos

- **R-01 — Cambio de orden observable:** aplicar estado, incrementar version, emitir evento y log en otro orden puede romper clientes. Mitigacion: snapshots de caracterizacion por slice y una tabla de traduccion `DomainEvent -> emisiones/logs` con el orden actual.
- **R-02 — Perdida de metadata al fusionar estado:** un reemplazo ingenuo podria borrar `socketId`, `version`, logs o timers. Mitigacion: adaptador unico con tests que preserven metadata y nunca acepte esos campos desde dominio.
- **R-03 — Callback stale tras retry o cambio de lock:** un timer viejo podria operar sobre una ronda nueva. Mitigacion: cada efecto lleva fase, razon y deadline esperados; la maquina rechaza discrepancias y reset limpia los handles del shell.
- **R-04 — Doble propietario transitorio:** wrappers antiguos podrian seguir ejecutando reglas. Mitigacion: sustitucion y borrado en el mismo slice, busqueda de simbolos anteriores y prohibicion de flags/doble escritura.
- **R-05 — Semantica distinta de poblaciones:** ready, consenso y settlement deliberadamente no usan los mismos jugadores. Mitigacion: mantener politicas nombradas y tests tabulares con conectado, desconectado, mano vacia y CPU.
- **R-06 — Settlement de estrella anticipado:** mezclar ack visual con regla puede aplicar cartas antes del cierre. Mitigacion: evento de preview sin mutacion de mano y comando idempotente de settlement que consume una sola resolucion pendiente.
- **R-07 — Cobertura global oculta huecos del dominio:** la integracion eleva el porcentaje aun con ramas puras sin probar. Mitigacion: gate separado de 80% para lineas, branches y funciones del limite de dominio.
- **R-08 — Checker incompleto:** revisar solo imports no detectaria reloj, azar o timers globales. Mitigacion: AST para imports, exports dinamicos y referencias a globales, con casos negativos por categoria.
- **R-09 — Scoring depende de historial reiniciado por nivel:** `dealLevel()` vacia `pileHistory`, por lo que la linea base final usa el historial vigente actual. Mitigacion: caracterizar exactamente el resultado antes de moverlo y no reinterpretar el alcance temporal durante esta extraccion.

# Estrategia de testing

- Congelar la linea base de 62 tests y ejecutar antes/despues de cada slice `docker compose run --build --rm --no-deps backend npm test`, `npm run test:coverage` y `npm run build` mediante los comandos canonicos de `AGENTS.md`.
- Crear fixtures deterministas de `DomainMatch` y probar que una misma entrada (`state`, comando, `now`, RNG/mazo y politica temporal) produce resultados profundamente iguales y no muta la entrada.
- Cubrir tablas de balance para 2-8 jugadores, maxLevel, vidas iniciales, estrella inicial, reparto por nivel, reward map y topes de cinco vidas/tres estrellas.
- Cubrir carta ajena, carta propia no minima, jugada correcta, uno/multiples bloqueantes, vida limitada a cero, errorCount, descarte y outcomes pause/level-complete/game-over.
- Cubrir ready/play/pause/consensus/settlement con fase, conectado, mano vacia, desconectado y CPU; mantener las poblaciones distintas de forma explicita.
- Cubrir estrella con propuesta, voto repetido, todos aceptan, cancelacion del proponente, rechazo ajeno, desconexion, manos vacias, preview sin mutacion, settlement de desconectados y consumo idempotente.
- Cubrir expiraciones validas y stale para dealing, countdown, error, estrella, round flip/unflip y avance de nivel usando `now` fijo y expectativas de efecto.
- Cubrir recompensas, derrota, victoria, retry, scoring y orden estable del ranking con tiempos/errorCounts fijos.
- Probar `domainAdapter.ts`: rechazo sin mutacion/version; exito conserva `socketId`, codigo, logs y metadata; eventos se traducen a payloads existentes sin exponer manos.
- Mantener y ampliar `socketIntegration.test.ts` para comparar acks, textos de error, eventos, logs, version, orden funcional, snapshot publico/privado, estrella, terminales y victoria en cada slice.
- Agregar tests del checker con fuentes en memoria que fallen individualmente para Fastify, Socket.IO, `node:*`, import de shell, `process`, reloj, azar y timers, mas un caso positivo del arbol real.
- Aplicar un gate medible de **>= 80% en lineas, branches y funciones** sobre `apps/backend/src/domain/**/*.ts` y `apps/backend/src/gameStateMachine.ts`, excluyendo tests y archivos solo declarativos. La cobertura global se sigue reportando para detectar regresiones generales.
- Al cierre ejecutar tambien los tests, cobertura y build de frontend para demostrar que no hubo cambio de contrato observable.

# Estrategia de documentacion

- Actualizar `.harness/context/domain.md` con lenguaje ubicuo, inventario final de propietarios e invariantes confirmadas por tests; conservar como incertidumbre cualquier comportamiento no confirmado.
- Actualizar `.harness/context/architecture.md` con limite fisico/logico, direccion de dependencias, forma de `DomainResult`, eventos/efectos, responsabilidades del adaptador, imports/globales prohibidos, comando `check:domain` y patron de migracion por slice.
- Actualizar `AGENTS.md` solo como indice hacia `domain.md`, `architecture.md`, `apps/backend/src/domain/` y la maquina canonica, sin copiar reglas normativas.
- Corregir `README.md` para reflejar el inicio manual por host y documentar los comandos de validacion de dominio, sin ampliar requisitos funcionales.
- Incluir comentarios de codigo solo en fronteras no obvias: mapping del adaptador, expectativas de timers stale y separacion preview/settlement de estrella.
- No modificar `.harness/templates/`; una revision final del diff verificara esta restriccion.

# Gaps resueltos

- No se requieren preguntas tecnicas adicionales: la SPEC aprobada fija comportamiento, pureza, maquina canonica, migracion y validacion, y el codigo/tests actuales permiten decidir el limite y el orden de slices.
- Se resolvio la convivencia de la ruta canonica `gameStateMachine.ts` con el nuevo directorio: pertenece al limite logico y queda incluida en guardas y cobertura.
- Se resolvio la responsabilidad de los acks de estrella: la espera es infraestructura; consenso, consumo y settlement son dominio.
- Se resolvio la comprobacion sin nueva dependencia: TypeScript AST ya esta instalado y Node 20 expone cobertura a reporters.
- Se resolvio el propietario del wire: contracts y serializers siguen fuera del dominio y actuan como adaptadores, sin cambios funcionales.

# Decision humana

Aprobar. La persona usuaria aprueba el diseno sin solicitar cambios.
