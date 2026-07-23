---
id: c4e8a1f2
slug: encapsular-infraestructura-backend-detras-de-puertos-manteniendo-comportamiento-in-memory
type: spec
created_at: 2026-07-23T08:42:19Z
created_by_command: /sdd:spec
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
approved_at: 2026-07-23T08:47:00Z
approved_by: user
---

# Solicitud refinada

Encapsular las dependencias operativas del backend detrás de puertos, conservando íntegramente el comportamiento en memoria, las reglas del juego, el balance y los contratos observables actuales. El alcance comprende el estado de salas y la asociación de jugadores, las fuentes de reloj y barajado, el scheduler y el ciclo de vida completo de los timers; las implementaciones concretas se organizarán bajo `infrastructure/` por capacidad operativa.

La propuesta debe dejar ownership y limpieza de recursos verificables, permitir pruebas deterministas mediante adaptadores fake, documentar los límites técnicos en las fuentes indicadas y automatizar su cumplimiento localmente. No incluye persistencia, cambios funcionales ni modificaciones a comandos SDD.

# Propuesta funcional

- Conservar la semántica actual de salas, jugadores, reconexión, presencia, versión, partidas y efectos temporizados usando únicamente estado en memoria; no se incorporará almacenamiento durable ni se alterarán reglas, balance, permisos, contratos realtime o privacidad.
- Hacer explícitos los límites que separan el estado de salas y jugadores, el tiempo, el barajado y la planificación diferida de los casos de uso y del dominio, de modo que las decisiones funcionales reciban datos o resultados declarados y no dependan de implementaciones concretas.
- Mantener las implementaciones de proceso agrupadas bajo `infrastructure/` por la capacidad que prestan. Ninguna implementación operativa decidirá fases, participantes, recursos, cartas, progreso ni resultados de la partida.
- Establecer un único ciclo de vida para cada trabajo diferido: creación, reemplazo por su identidad estable, ejecución, cancelación y limpieza. La responsabilidad debe cubrir el reemplazo de una transición, el borrado de sala, retry, desconexión o cierre del proceso cuando corresponda, y los callbacks tardíos no podrán mutar ni publicar.
- Proveer adaptadores fake deterministas para estado, reloj, barajado/azar y scheduler, de forma que las pruebas controlen las entradas y puedan inspeccionar trabajos pendientes, reemplazados, cancelados y ejecutados sin reloj ni timers reales.
- Registrar en `architecture.md` los puertos, adaptadores, ownership de efectos y reglas de cleanup; actualizar `domain.md` únicamente si la migración revela una decisión funcional; y mantener `AGENTS.md` como índice hacia esas referencias y los comandos existentes.
- Automatizar en tooling local las direcciones de dependencia: la infraestructura puede implementar y depender de la aplicación, mientras dominio y aplicación no pueden importar infraestructura concreta. No se modificarán ni especializarán comandos SDD.

# Criterios de aceptacion

## CA-01 — Comportamiento en memoria conservado

**DADO** una sala con jugadores, presencia, reconexión, versión, partida y posibles efectos temporizados  
**CUANDO** se encapsulan sus dependencias operativas detrás de puertos y adaptadores  
**ENTONCES** la información sigue viviendo exclusivamente en memoria y se conservan los resultados observables de sala y partida, sin añadir base de datos ni cambiar balance, reglas, permisos, contratos realtime o privacidad.  
**Validacion:** regresiones unitarias e integración existentes para creación, unión, salida, reconexión, partida y snapshots, junto con inspección de dependencias y configuración que confirme la ausencia de persistencia añadida.

## CA-02 — Estado, reloj, barajado y scheduler con límites explícitos

**DADO** un caso de uso que necesita consultar o guardar una sala, localizar a un jugador, obtener tiempo, formar un mazo o diferir una transición  
**CUANDO** se ejecuta en producción o en una prueba  
**ENTONCES** usa el puerto correspondiente y no una implementación concreta; el adaptador de producción conserva el comportamiento in-memory, el reloj y azar del proceso y la planificación vigente.  
**Validacion:** pruebas unitarias de los casos de uso con adaptadores sustitutos, revisión de imports de producción y comparación de los resultados de códigos de sala, reparto y deadlines con la línea base.

## CA-03 — Efectos temporizados con ownership y cleanup único

**DADO** un efecto diferido de dealing, countdown, carta, progreso, CPU, estrella u otro flujo temporal cubierto  
**CUANDO** se crea, se sustituye por la misma identidad, vence, la sala se elimina, la partida se reintenta o el proceso se reinicia  
**ENTONCES** existe un único responsable de programarlo, cancelarlo y retirarlo; el reemplazo cancela el trabajo previo, la limpieza retira todos los trabajos de la sala cuando aplica y un callback stale no guarda, publica ni muta la partida.  
**Validacion:** pruebas deterministas de reemplazo por clave, vencimiento, cancelación individual y por sala, retry, eliminación y lifecycle del servidor; aserción de que no quedan trabajos pendientes al finalizar cada flujo cubierto.

## CA-04 — Decisiones puras sin efectos ocultos

**DADO** una función de dominio o de aplicación que decide una acción o transición de la partida  
**CUANDO** se invoca con los mismos datos de entrada y adaptadores controlados  
**ENTONCES** sus decisiones funcionales son repetibles y los efectos externos se expresan o materializan únicamente a través de los límites declarados, sin timers, reloj real, azar real ni infraestructura oculta en funciones aparentemente puras.  
**Validacion:** tests repetibles con reloj, random y scheduler controlados, más comprobación automatizada de globals e imports prohibidos en el dominio y de dependencias concretas en aplicación.

## CA-05 — Fakes deterministas de las capacidades operativas

**DADO** pruebas de casos de uso y de callbacks temporizados  
**CUANDO** necesitan avanzar el tiempo, elegir valores aleatorios, consultar o modificar salas y ejecutar trabajo diferido  
**ENTONCES** pueden hacerlo con adaptadores fake deterministas sin abrir red, usar `Date.now`, `Math.random` ni timers reales, y pueden observar el orden, estado y cleanup de los recursos controlados.  
**Validacion:** suite sin red que cubra éxito, rechazo, callback a tiempo y stale, y que demuestre control explícito de reloj, random y scheduler.

## CA-06 — Dirección de dependencias automatizada

**DADO** las capas `domain/`, `application/` e `infrastructure/`  
**CUANDO** se ejecutan los checks locales del backend  
**ENTONCES** se permite la dirección `infrastructure -> application`, se rechazan imports de infraestructura desde `application/` y `domain/`, y se mantienen las demás prohibiciones ya aplicables al dominio y a la aplicación.  
**Validacion:** checker ejecutable sobre el árbol real y fixtures negativos para cada arista prohibida, integrado en los comandos locales de validación ya existentes.

## CA-07 — Contexto técnico trazable y sin alcance funcional inventado

**DADO** los puertos, adaptadores, ownership de efectos y reglas de cleanup resultantes  
**CUANDO** se revisan `.harness/context/architecture.md`, `.harness/context/domain.md` y `AGENTS.md`  
**ENTONCES** `architecture.md` registra los límites y operaciones técnicas verificables, `domain.md` solo cambia si se confirma una decisión funcional y `AGENTS.md` permanece como índice hacia adaptadores y comandos, sin duplicar reglas ni alterar comandos SDD.  
**Validacion:** revisión cruzada de documentación contra código y tooling, más diff que confirme que no se añadieron reglas técnicas al dominio ni cambios a comandos SDD.

# Gaps resueltos

Ninguno. La solicitud delimita las capacidades operativas, las restricciones de comportamiento y las validaciones necesarias; la evidencia actual confirma que salas, jugadores y efectos temporizados son internos al proceso y que no se requiere una decisión funcional adicional.

# Decision humana

Aprobar. La persona usuaria aprobó la propuesta mediante `Aprobado`, equivalente inequívoco a `Aprobar`.
