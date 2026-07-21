---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: spec
created_at: 2026-07-20T17:30:22Z
created_by_command: /sdd:spec
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
approved_at: 2026-07-20T17:38:24Z
approved_by: user
---

# Solicitud refinada

Extraer las reglas de la partida cooperativa actualmente repartidas entre `apps/backend/src/index.ts` y sus helpers hacia un dominio puro, modular y testeable, sin ceremonial innecesario y con un unico propietario activo para cada regla.

El alcance funcional comprende partida, ronda, jugador, mano, pila, vidas, estrellas, recompensas y consenso; las reglas de juego de cartas, penalizaciones, descartes, pausa, ready, estrella, progresion de nivel y resolucion final; la reutilizacion de la maquina de estados canonica; resultados explicitos mediante estado y/o eventos de dominio; y una migracion incremental que retire cada regla anterior cuando se active su reemplazo.

La extraccion debe conservar el comportamiento observable actual, documentar el lenguaje e invariantes confirmados, declarar y comprobar automaticamente los limites de dependencias del dominio y dejar `AGENTS.md` como indice hacia la documentacion canonica, sin modificar plantillas SDD genericas.

# Propuesta funcional

- Elaborar un inventario trazable de los conceptos y reglas incluidos, indicando para cada regla su propietario vigente durante la migracion y evitando que dos caminos activos puedan resolver la misma accion.
- Trasladar al dominio las decisiones de cartas, penalizacion de vidas, descartes, pausa, ready, consenso y uso de estrella, progresion y recompensas de nivel, derrota, victoria y resultados finales que hoy constituyen comportamiento de negocio.
- Mantener `apps/backend/src/gameStateMachine.ts` como fuente canonica de autorizacion de fases y transiciones, integrandola con las reglas extraidas sin reproducir sus decisiones en otro lugar.
- Hacer que cada operacion de dominio reciba datos deterministas y produzca un resultado explicito en el estado y/o en eventos de dominio; transporte, temporizadores reales, entorno e infraestructura quedan fuera de esas decisiones.
- Migrar por slices funcionales con caracterizacion previa del comportamiento observable. Al activar un slice, sus consumidores usan el nuevo propietario y se elimina o desactiva definitivamente la implementacion anterior.
- Confirmar y documentar en `.harness/context/domain.md` el lenguaje ubicuo y las invariantes verificadas durante la extraccion, sin convertir incertidumbres no resueltas en reglas.
- Documentar en `.harness/context/architecture.md` los limites aplicables al dominio, los imports prohibidos y las convenciones que deban comprobarse; enlazar esa referencia desde `AGENTS.md` sin copiar alli las reglas.
- Incorporar una comprobacion local automatica y repetible que haga fallar la validacion cuando el dominio incumpla los limites documentados, incluyendo la prohibicion de Fastify, Socket.IO, timers, entorno, transporte e infraestructura.
- Conservar contratos Socket.IO, acks, eventos, snapshots publicos/privados, privacidad, versionado y resultados observables cubiertos por la linea base existente.
- Mantener las restricciones de esta extraccion limitadas al contexto y codigo del proyecto, sin propagarlas a plantillas SDD genericas y sin introducir abstracciones sin una regla o variacion real que las justifique.

# Criterios de aceptacion

## CA-01 — Inventario y propietario unico de reglas

**DADO** el conjunto de conceptos partida, ronda, jugador, mano, pila, vidas, estrellas, recompensas y consenso, y las reglas incluidas en esta solicitud  
**CUANDO** se revise el resultado de la extraccion y el estado de cada slice  
**ENTONCES** cada concepto y regla tiene una ubicacion canonica identificable y existe un solo camino activo que toma su decision de negocio.  
**Validacion:** inventario trazable contra `apps/backend/src/index.ts`, helpers de reglas y tests; busqueda de implementaciones activas duplicadas para cada regla migrada.

## CA-02 — Dominio puro y determinista

**DADO** cualquier operacion de dominio extraida y un conjunto fijo de datos de entrada  
**CUANDO** la operacion se ejecuta repetidamente sin transporte ni infraestructura  
**ENTONCES** produce el mismo resultado explicito de estado y/o eventos, sin leer Fastify, Socket.IO, timers reales, variables de entorno, transporte o infraestructura.  
**Validacion:** tests unitarios con fixtures, reloj y datos deterministas, mas la comprobacion automatica de imports prohibidos.

## CA-03 — Juego de cartas, penalizacion y descartes

**DADO** una ronda activa sin bloqueo y las manos conocidas de todos los jugadores  
**CUANDO** un jugador intenta jugar una carta  
**ENTONCES** solo puede jugar la carta minima de su propia mano; si quedan cartas globalmente menores que la jugada, se registra la jugada, se pierde exactamente una vida, se contabiliza el error del jugador y se descartan todas esas cartas menores; si no las hay, no se aplica penalizacion.  
**Validacion:** tests de dominio con manos deterministas para carta ajena, carta propia no minima, jugada correcta, uno o varios descartes bloqueantes y vida limitada a cero; comparacion con los escenarios Socket.IO existentes.

## CA-04 — Pausa, ready y reanudacion

**DADO** una ronda en `focus`, `playing` o `paused`, con jugadores conectados que pueden tener o no cartas  
**CUANDO** se solicita pausa o se cambia ready  
**ENTONCES** se conservan las poblaciones canonicas actuales: juegan, pausan y hacen ready los conectados con cartas; los jugadores sin cartas no bloquean el quorum; el quorum completo habilita el countdown mediante la maquina de estados canonica.  
**Validacion:** tests tabulares de dominio para fases, conexion, mano y ready, incluidos los casos ya cubiertos por `roundParticipants.test.ts` y `gameStateMachine.test.ts`.

## CA-05 — Consenso y resolucion de estrella

**DADO** una ronda activa, al menos una estrella disponible y una propuesta de estrella  
**CUANDO** los participantes aceptan, cancelan o rechazan la propuesta  
**ENTONCES** el consenso incluye a todos los jugadores conectados aunque no tengan cartas; solo el proponente cancela y los demas pueden rechazar; al aceptar todos se consume una estrella una sola vez y el settlement descarta la carta minima de cada mano no vacia, incluida la de jugadores desconectados, sin aplicar antes de la confirmacion o cierre vigente.  
**Validacion:** tests deterministas de propuesta, votos repetidos, cancelacion, rechazo, desconexion, manos vacias, settlement y consumo unico; regresion con los escenarios Socket.IO de estrella.

## CA-06 — Nivel, recursos, recompensas y final

**DADO** las configuraciones soportadas de jugadores, nivel, vidas, estrellas, manos y mapa de recompensas  
**CUANDO** se inicia o reintenta una partida, se reparte un nivel, se vacian las manos, se aplica una recompensa o se alcanza una condicion terminal  
**ENTONCES** se conservan el balance actual por cantidad de jugadores, una estrella inicial, el reparto de tantas cartas por jugador como el nivel, los topes de cinco vidas y tres estrellas, el mapa de recompensas vigente, la derrota sin vidas, la victoria al completar el nivel maximo y el ranking final vigente.  
**Validacion:** tests tabulares deterministas para todas las cantidades soportadas, niveles con y sin recompensa, topes, derrota, victoria, retry y scoring final; escenario de integracion que alcanza victoria.

## CA-07 — Maquina de estados canonica reutilizada

**DADO** una accion que depende de fase, lock, actor o expiracion temporal  
**CUANDO** el dominio decide si puede ejecutarse o resolverse  
**ENTONCES** la aceptacion o rechazo procede de la maquina de estados canonica y los callbacks obsoletos no alteran la partida; ninguna regla extraida crea una autorizacion paralela de fases.  
**Validacion:** tests de transiciones validas e invalidas y de expiraciones stale, mas trazabilidad de los consumidores hacia una unica fuente canonica.

## CA-08 — Resultados de dominio consumibles

**DADO** una accion valida o rechazada de cartas, pausa, ready, estrella, nivel o final  
**CUANDO** se ejecuta su regla de dominio  
**ENTONCES** el resultado contiene todo el estado y/o eventos de dominio necesarios para que el exterior refleje la decision sin recalcular la regla de negocio.  
**Validacion:** tests que inspeccionan el resultado de cada familia de acciones y pruebas de adaptacion que demuestran que no se vuelve a decidir la regla al emitir respuestas o eventos.

## CA-09 — Migracion por slices sin duplicacion

**DADO** un slice funcional preparado con pruebas de caracterizacion  
**CUANDO** su reemplazo de dominio se activa  
**ENTONCES** todos sus consumidores usan el nuevo propietario y la regla anterior deja de ser ejecutable antes de comenzar el siguiente estado estable de la migracion.  
**Validacion:** por cada slice, pruebas de caracterizacion antes y despues, busqueda del camino anterior y ejecucion de la suite sin flags ni doble escritura de reglas.

## CA-10 — Contexto del proyecto actualizado

**DADO** las reglas e invariantes confirmadas durante la extraccion  
**CUANDO** se revisan `.harness/context/domain.md`, `.harness/context/architecture.md` y `AGENTS.md`  
**ENTONCES** `domain.md` contiene lenguaje ubicuo e invariantes confirmadas, `architecture.md` es la fuente de limites, imports prohibidos, patrones y convenciones del dominio, y `AGENTS.md` solo referencia esa capa y sus fuentes canonicas sin duplicar reglas.  
**Validacion:** revision cruzada de los tres documentos contra el dominio ejecutable y ausencia de la misma definicion normativa en `AGENTS.md`.

## CA-11 — Limites comprobados automaticamente

**DADO** los limites de imports declarados en `architecture.md`  
**CUANDO** se ejecuta la validacion local del backend  
**ENTONCES** la comprobacion pasa para el dominio valido y falla de forma explicita al introducir cualquiera de las dependencias prohibidas, incluidas Fastify, Socket.IO, timers, entorno, transporte o infraestructura.  
**Validacion:** prueba positiva sobre el arbol real y fixtures negativos o prueba automatizada equivalente para cada categoria prohibida; comando local documentado y repetible.

## CA-12 — Conservacion del comportamiento externo

**DADO** la linea base de integracion y contratos realtime existente antes de cada slice  
**CUANDO** se ejecutan los mismos recorridos tras activar el reemplazo  
**ENTONCES** se conservan resultados de partida, errores, acks, eventos, logs, orden funcional, versionado, snapshots y separacion de estado publico y privado, sin exponer manos ni datos internos.  
**Validacion:** suite de integracion Socket.IO y tests de contratos ejecutados antes y despues de cada slice, junto con tests backend, cobertura y build canonicos.

## CA-13 — Sin ceremonial ni cambios en plantillas genericas

**DADO** la implementacion completa de la extraccion  
**CUANDO** se inspeccionan sus tipos, abstracciones y cambios documentales  
**ENTONCES** cada clase, interfaz o abstraccion introducida responde a una regla, dato o variacion efectiva del dominio, y ninguna plantilla SDD generica contiene los limites particulares de esta capa.  
**Validacion:** revision de trazabilidad de abstracciones y diff que confirme ausencia de cambios en `.harness/templates/` por estas restricciones.

# Gaps resueltos

Ninguno. La peticion y la linea base documentada permiten delimitar las reglas, restricciones, migracion y validacion sin introducir decisiones funcionales adicionales.

# Decision humana

Aprobar. La persona usuaria aprueba la propuesta sin solicitar cambios.
