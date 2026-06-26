## Criterios de aceptacion

- DADO una partida en curso con cambios de fase, locks o mensajes temporales, CUANDO el backend emite un snapshot de sala, ENTONCES el snapshot incluye tiempos absolutos del servidor suficientes para renderizar countdowns, bloqueos y progress bars sin que el frontend duplique delays funcionales.
- DADO el modelo final de snapshot privado completo, CUANDO el frontend recibe un snapshot con `version <= lastAppliedVersion`, ENTONCES lo ignora y no pisa estado mas reciente.
- DADO la fase migratoria donde aun existan `room:update` y `player:state` separados, CUANDO ambos mensajes comparten version, ENTONCES el frontend los correlaciona y aplica sala + mano de forma atomica o mediante una regla explicita que impida mezclar versiones distintas.
- DADO que un jugador intenta acciones como ready, play card, pause, propose star, accept star o retry, CUANDO el frontend pinta la interfaz, ENTONCES la visibilidad y habilitacion funcional de botones se deriva de acciones privadas enviadas por el backend al jugador receptor y no de reglas locales duplicadas ni de un snapshot publico.
- DADO un evento temporal de partida como dealing, countdown, error penalty, star resolved, level complete o retry, CUANDO el evento afecta la posibilidad de interactuar, ENTONCES el backend decide `lockUntil` o deadline equivalente y el frontend solo renderiza el estado temporal recibido.
- DADO un overlay, mensaje temporal o progress bar, CUANDO el frontend lo muestra, ENTONCES calcula el progreso localmente usando `serverTime`, `startsAt` y `endsAt`, sin recibir porcentajes ni decidir la duracion funcional.
- DADO que se emiten eventos parciales como logs, sonidos o efectos visuales, CUANDO dichos eventos llegan tarde o fuera de orden, ENTONCES no modifican reglas, fases, locks, acciones disponibles ni recursos de la partida.
- DADO una reconexion o resync periodico, CUANDO `room:resync` responde con estado de sala y mano privada, ENTONCES la respuesta usa un snapshot privado por jugador compuesto por `publicState` y `privateState` con una unica `version` para evitar mezclar estados de versiones distintas.
- DADO que un mensaje temporal llega al frontend despues de su `endsAt`, CUANDO se aplica el snapshot o evento decorativo asociado, ENTONCES el frontend no reinicia overlays, progress bars, locks locales ni bloqueos funcionales.
- DADO que un comando de usuario recibe un ack exitoso, CUANDO la mutacion funcional correspondiente ya esta cubierta por snapshots autoritativos versionados, ENTONCES el ack no muta estado funcional en frontend y solo confirma recepcion, error o rechazo del comando.
- DADO el modo dev-cpu, pausas, estrellas, penalizaciones y progresion de nivel existentes, CUANDO se complete el refactor incremental, ENTONCES el comportamiento observable del juego se mantiene sin regresiones funcionales.

## Tareas tecnicas

1. Documentar el contrato actual antes de modificarlo.
   - Revisar en `apps/backend/src/index.ts` las emisiones `room:update`, `player:state`, `game:error-penalty`, `game:paused`, `game:star-used`, `game:level-complete`, `game:next-level-ready`, `game:started`, `game:restarted` y `game:over`.
   - Revisar en `apps/frontend/src/App.tsx` los handlers Socket.IO, los `useState`/`useRef` temporales y los calculos de botones.
   - Dejar inventario de timers actuales: `cpuPlayTimers`, `levelCompleteTimers`, `interactionLockTimers`, countdown local, overlay timeout, level-complete overlay timeout, pile-clear timeout, deal interval, resync interval/timeout y resource pulse.
   - Distinguir para cada timer si es funcional, visual/decorativo o mixto, indicando que timers funcionales deben migrar a deadlines autoritativos del backend y que timers puramente visuales pueden quedarse si no deciden reglas, locks, recursos ni acciones.
   - Documentar durante el inventario que `room:update` y `player:state` hoy son canales separados y que esa separacion es uno de los riesgos centrales de mezcla de versiones.

2. Introducir versionado monotono en backend.
   - Agregar a `Room` un contador `version` o `sequence` incrementado en cada mutacion observable de sala o juego.
   - Centralizar las mutaciones que emiten snapshot para evitar incrementos inconsistentes.
   - Incluir `version` en `serializeRoom()` y en respuestas de `room:create`, `room:join` y `room:resync` mientras exista el contrato actual.
   - Incrementar `version` solo por cambios funcionales observables: fase, locks, recursos, jugadores, ready, manos, pila, propuesta de estrella, resultados finales, acciones disponibles privadas o mensajes temporales funcionales.
   - No incrementar `version` por eventos puramente decorativos como sonidos, pulses, logs visuales, analytics o efectos que no cambian reglas ni capacidad de interactuar.
   - Mantener logs con su `id`/`ts` actual, pero no usarlos como version de estado.

3. Hacer que `room:resync` sea version-aware.
   - Aceptar opcionalmente `knownVersion` desde frontend.
   - Responder con un snapshot privado por jugador que incluya `version`, `serverTime`, `publicState` y `privateState`.
   - Definir si una respuesta sin cambios devuelve snapshot completo igualmente o un payload ligero; para migracion incremental, preferir snapshot completo versionado.
   - Evitar contratos separados donde `room:update` y `player:state` puedan representar versiones distintas sin una forma explicita de correlacion.

4. Anadir tiempo de servidor al snapshot.
   - Incluir `serverTime: Date.now()` en `serializeRoom()` o en una envoltura comun de snapshot.
   - Evitar que el frontend compare directamente `Date.now()` con deadlines del servidor sin calibracion.
   - En frontend, estimar offset con midpoint solo cuando haya round-trip medible, por ejemplo `room:resync` o un ping dedicado: `clientSentAt`, `clientReceivedAt`, `serverTime` y `estimatedServerAtReceive = serverTime + (clientReceivedAt - clientSentAt) / 2`; guardar offset aproximado `estimatedServerAtReceive - clientReceivedAt`.
   - En snapshots push normales, usar el offset previamente calculado y no recalcularlo agresivamente con cada mensaje entrante para evitar jitter por latencia variable.
   - Usar el offset calculado para convertir `Date.now()` local a tiempo servidor estimado al renderizar countdowns y progress bars.

5. Evolucionar `InteractionLock` hacia contrato autoritativo de deadline.
   - Mantener compatibilidad inicial con `{ reason, until }`.
   - Agregar alias/campos claros como `lockUntil`, `startsAt`, `endsAt` o `inputLock` segun se decida en el contrato.
   - Revisar `apps/backend/src/gameTiming.ts` para que sea la fuente unica de duraciones funcionales: dealing, countdown, error, star y level-complete.
   - Revisar `apps/backend/src/levelFlow.ts` para que transiciones de siguiente nivel expongan deadlines en estado, no solo timers internos.

6. Proponer y aplicar gradualmente un snapshot privado por jugador.
   - Modelar el payload autoritativo como `{ version, serverTime, publicState, privateState }`.
   - `publicState` debe contener solo informacion segura para toda la sala: codigo, host, jugadores publicos, fase, recursos compartidos, pila, historial publico, locks publicos, propuesta de estrella sin filtrar manos, mensajes funcionales publicos y resultados finales.
   - `privateState` debe contener datos exclusivos del receptor: mano privada, acciones disponibles del jugador y cualquier razon de bloqueo especifica del jugador.
   - Campos sugeridos en `publicState.game`: `phase`, `phaseStartedAt`, `phaseEndsAt`, `inputLockUntil`, `inputLockReason`, `messages[]`, `transitions`, `resources`, `pile`, `pileHistory`, `starProposal`, `finalResults`.
   - Campos sugeridos en `privateState`: `hand`, `availableActions`, `actionReasons` si aplica.
   - No exponer `availableActionsByPlayer` en snapshot publico porque puede filtrar informacion indirecta de otros jugadores.

7. Mover decisiones de acciones disponibles al backend.
   - Crear helper backend para calcular acciones disponibles por jugador usando fase, locks, host, ready, mano, estrellas, propuesta de estrella y estado de conexion.
   - Cubrir acciones: `ready`, `unready`, `start`, `play_card`, `pause`, `propose_star`, `accept_star`, `retry`, `leave`.
   - Mantener validaciones existentes en handlers como autoridad final; `availableActions` es contrato de UI, no sustituto de validacion.
   - Emitir acciones solo dentro de `privateState` para el jugador receptor.
   - Evitar `visibleActions` como concepto separado salvo que aparezca una necesidad real; si hace falta distinguir visibilidad y habilitacion, modelar cada accion como `{ type, visible, enabled, reason }` dentro de `availableActions` privado.

8. Simplificar gradualmente eventos Socket.IO funcionales.
   - Mantener comandos cliente-servidor actuales con ack: `player:ready`, `game:start`, `game:play-card`, `game:pause-request`, `star:propose`, `star:accept`, `game:retry`.
   - Convertir broadcasts parciales funcionales a efectos secundarios no autoritativos: `game:error-penalty`, `game:paused`, `game:star-used`, `game:level-complete`, `game:next-level-ready`, `game:restarted`, `game:over`.
   - Definir que el estado funcional siempre llega por snapshot versionado.
   - Incluir `version` en eventos parciales decorativos si se conservan.
   - Permitir que eventos parciales disparen FX, sonidos o logs solo si referencian una `version` compatible con la version aplicada actual.
   - Prohibir que eventos parciales modifiquen reglas, locks, fases, recursos, acciones disponibles, manos o bloqueos.

9. Migrar frontend para aplicar snapshots con proteccion de version.
   - En `apps/frontend/src/App.tsx`, reemplazar `setRoom(updatedRoom)` directo por un aplicador `applyPrivateSnapshot(snapshot)` que compare `version` y aplique juntos `publicState` y `privateState`.
   - En el modelo final de snapshot privado completo, ignorar cualquier snapshot con `version <= lastAppliedVersion`.
   - Durante la migracion, si aun existen `room:update` y `player:state` separados, incluir `version` en ambos y no ignorar automaticamente un `player:state` con la misma version que el `room:update` ya recibido; correlacionarlos por version y aplicar sala + mano de forma atomica cuando ambos esten disponibles, o definir una regla explicita de buffering/fallback para no mezclar sala de una version con mano de otra.
   - Preferir como objetivo final un unico snapshot privado por jugador para no mezclar `room:update` de una version con `player:state` de otra.
   - Evitar que respuestas tardias de resync pisen acciones realtime mas recientes.

10. Definir semantica de acks de comandos.
   - Mantener acks para confirmar recepcion, validacion, error o rechazo de comandos.
   - Evitar que handlers frontend de ack muten estado funcional si esa mutacion llega por snapshot autoritativo.
   - Permitir que un ack muestre errores de comando rechazado, pero no que actualice fase, recursos, mano, locks, acciones disponibles ni mensajes funcionales.
   - Revisar `createRoom`, `joinRoom`, `setReady`, `startGame`, `playCard`, `requestPause`, `proposeStar`, `acceptStar`, `retryMatch` y `leaveRoom` en `apps/frontend/src/App.tsx` para separar feedback de comando y aplicacion de estado.

11. Eliminar gradualmente timers funcionales del frontend.
   - En `apps/frontend/src/gameUi.ts`, limitar helpers a interpretar deadlines autoritativos con offset de servidor.
   - En `apps/frontend/src/messageTiming.ts`, dejar solo copy/fallback visual o mover duraciones funcionales al backend.
   - En `apps/frontend/src/levelFlow.ts`, convertir el calculo de delay de overlay de nivel en animacion puramente visual que no bloquee inputs ni decida transiciones.
   - En `apps/frontend/src/App.tsx`, quitar dependencia funcional de `dealIntervalRef`, `levelCompleteOverlayTimeoutRef`, `pileClearStartTimeoutRef` y `eventOverlayTimeoutRef`; conservar solo animaciones no autoritativas si no cambian reglas ni botones.

12. Replantear overlays y progress bars.
   - Agregar en snapshot un `activeMessage` o `messages[]` con `id`, `type`, `severity`, `startsAt`, `endsAt`, `payload` y, si aplica, `version`.
   - No acoplar copy final al backend: el backend decide tipo, severidad, ventana temporal y datos; el frontend decide textos, subtitulos, iconos y presentacion.
   - Hacer que error penalty, star resolved, level complete y retry se pinten desde esos campos.
   - Calcular progress bar en frontend con `(nowServerAdjusted - startsAt) / (endsAt - startsAt)`.
   - Si un mensaje llega expirado (`nowServerAdjusted >= endsAt`), descartarlo para overlays/progress bars o mostrarlo solo como log historico; no reiniciar overlays, locks ni bloqueos locales.

13. Replantear countdown y dealing.
   - Usar deadlines del backend para countdown (`phase='countdown'` o `inputLockReason='countdown'`) y para dealing.
   - Evitar que el reveal local de mano bloquee botones por si solo; el bloqueo debe venir de `inputLockUntil` o `availableActions`.
   - Mantener animacion de reveal como efecto visual que puede terminar despues sin impedir acciones autorizadas por backend, salvo que producto quiera bloquearlo explicitamente desde backend.

14. Ajustar star UI y descarte visual.
   - Revisar `apps/frontend/src/starUi.ts` para que `mergeHandWithStarDiscard()` sea solo una ayuda visual ligada a un mensaje/efecto versionado.
   - Asociar cualquier uso de `mergeHandWithStarDiscard()` a un `message` o evento decorativo con `version` compatible con el snapshot aplicado.
   - Prohibir que `mergeHandWithStarDiscard()` reconstruya o sustituya la mano funcional del jugador.
   - Evitar que el frontend reconstruya estado funcional de mano a partir de evento `game:star-used`; la mano real debe venir por `player:state` versionado.
   - En el modelo final, la mano real debe venir siempre de `privateState.hand` dentro del snapshot privado versionado.

15. Mantener compatibilidad incremental durante la migracion.
   - Fase 1: agregar campos nuevos sin eliminar los antiguos.
   - Fase 2: agregar `version` a `room:update`, `player:state`, `room:resync` y eventos parciales conservados; el frontend empieza a ignorar payloads antiguos.
   - Fase 3: introducir snapshot privado `{ publicState, privateState, version }` y usarlo en resync.
   - Fase 4: emitir snapshots privados realtime por jugador, manteniendo temporalmente `room:update`/`player:state` como compatibilidad si hace falta.
   - Fase 5: frontend empieza a preferir `version`, `serverTime`, offset midpoint, `privateState.availableActions` y mensajes autoritativos, con fallback al contrato antiguo.
   - Fase 6: backend marca eventos parciales como decorativos y exige compatibilidad de version para FX/logs.
   - Fase 7: eliminar calculos/timers funcionales antiguos del frontend.
   - Fase 8: limpiar broadcasts parciales que ya no tengan consumidores funcionales.

16. Agregar pruebas backend.
   - Tests unitarios para incremento de version ante mutaciones relevantes.
   - Tests de `gameTiming.ts` para deadlines absolutos y compatibilidad de locks.
   - Tests de `levelFlow.ts` para deadlines de cierre de ronda y avance de nivel.
   - Tests de `availableActions` privadas por fase: lobby, focus, countdown, playing, paused, level-complete, game-over y victory.
   - Tests para confirmar que el snapshot publico no expone `availableActionsByPlayer` ni manos privadas.
   - Tests para `room:resync` versionado y snapshot privado si se extrae la logica a helpers testeables.
   - Tests para confirmar que logs/FX decorativos no incrementan `version`.

17. Agregar pruebas frontend.
   - Tests de helpers en `gameUi.ts` para calcular tiempo restante con offset de servidor estimado por midpoint.
   - Tests de aplicacion de snapshots privados para ignorar versiones antiguas y aplicar `publicState` + `privateState` de forma atomica.
   - Tests de derivacion visual desde `availableActions` en helpers puros, evitando testear todo `App.tsx` si se mantiene arquitectura monolitica.
   - Tests de progress bar basada en `startsAt`/`endsAt` sin porcentajes backend.
   - Tests para mensajes expirados: no deben reiniciar overlay ni lock visual.
   - Tests para eventos parciales decorativos con version incompatible: deben ignorarse para FX/logs.
   - Tests para correlacion transitoria de `room:update` y `player:state`: misma version se aplica de forma atomica o por regla explicita, versiones distintas no se mezclan.
   - Tests para acks: un ack exitoso no debe mutar estado funcional cubierto por snapshot autoritativo.
   - Tests para `starUi.ts`: `mergeHandWithStarDiscard()` solo afecta vista temporal versionada y nunca reemplaza `privateState.hand`.

18. Validacion manual por Docker Compose.
   - Arrancar con `docker compose up --build`.
   - Validar lobby, start, ready, countdown, play card correcto, error penalty, star proposal/accept/resolution, pause/resume, level complete, victory/game-over, retry y reconexion.
   - Validar modo CPU con codigos `CPUON[1-7]` porque usa timers backend propios.

19. Riesgos a gestionar durante el refactor.
   - Riesgo de romper reconexion por mezclar version de sala y version de mano privada; mitigacion principal: snapshot privado atomico con una unica `version`.
   - Riesgo de exponer informacion privada si `availableActionsByPlayer` revela datos de mano de otros jugadores.
   - Riesgo de crear demasiados snapshots si se incrementa version/emite en cada log decorativo.
   - Riesgo de desfase visual si se usa reloj cliente sin offset con `serverTime`.
   - Riesgo de acoplar demasiado mensajes UX al backend y dificultar copy/idioma en frontend.
   - Riesgo de mantener doble contrato demasiado tiempo y reintroducir dobles fuentes de verdad.

## Decisiones tomadas

- El refactor sera incremental y no eliminara de entrada los eventos ni campos actuales; primero se agregara contrato autoritativo compatible.
- El backend sera la fuente de verdad para fases, reglas, locks, acciones disponibles, mensajes temporales y deadlines.
- El frontend podra mantener timers solo para animaciones visuales, limpieza decorativa o render de progreso basado en timestamps absolutos del servidor; no podra usarlos para decidir interaccion funcional.
- Los timestamps temporales se modelaran como valores absolutos emitidos por backend (`serverTime`, `startsAt`, `endsAt`, `lockUntil` o equivalentes), no como porcentajes.
- Se introducira un `version` o `sequence` monotono por sala; en el modelo final protege snapshots privados completos frente a mensajes viejos y, durante la migracion, sirve para correlacionar `room:update` y `player:state` sin mezclar versiones.
- Los eventos parciales Socket.IO dejaran de controlar logica funcional y quedaran como soporte de log, sonidos o efectos visuales.
- Se respetara la arquitectura actual de aplicaciones monoliticas (`apps/backend/src/index.ts` y `apps/frontend/src/App.tsx`) durante la planificacion, aunque las tareas recomiendan extraer helpers puros testeables cuando reduzca riesgo.
- La mano privada seguira protegida: el snapshot publico no debe exponer cartas completas de otros jugadores; cualquier estado privado versionado debe emitirse solo al socket correspondiente.
