## Criterios de aceptacion

- DADO que aparece un mensaje que bloquea la interaccion del jugador CUANDO se calcula su duracion ENTONCES dura 1 segundo mas que la duracion bloqueante actual equivalente.
- DADO que aparece cualquier overlay o mensaje principal de estado de partida CUANDO se renderiza en pantalla ENTONCES muestra un subtitulo breve en ingles que explica que ha pasado o que puede/no puede hacer el jugador.
- DADO que un jugador ve la propuesta de activacion de estrella CUANDO debe aceptar o esperar consenso ENTONCES el subtitulo comunica en ingles que aceptar la activacion descartara la carta mas baja de todos los jugadores.
- DADO que una estrella se activa y descarta cartas CUANDO se muestra el overlay de descarte ENTONCES el subtitulo comunica en ingles que se estan descartando las cartas mas bajas de todos.
- DADO que ocurre una penalizacion por error CUANDO se muestra el overlay de error ENTONCES el subtitulo comunica en ingles que el equipo tiene una vida menos.
- DADO que la partida termina en victoria CUANDO se muestra el mensaje final ENTONCES el subtitulo comunica en ingles que las mentes estan plenamente conectadas.
- DADO que la partida termina en derrota CUANDO se muestra el mensaje final ENTONCES el subtitulo comunica en ingles que la colmena aun necesita conectarse mejor.
- DADO que las cartas de un nuevo nivel ya se han repartido pero el mensaje de nivel completado sigue visible CUANDO el jugador intenta marcar ready o interactuar para continuar ENTONCES la UI y el backend mantienen el bloqueo hasta que el mensaje termine.
- DADO que una estrella activa descarta las ultimas cartas del nivel CUANDO tambien se dispara el flujo de nivel completado ENTONCES el mensaje de nivel completado espera a que termine el mensaje de descarte por estrella y no se superpone.
- DADO que se completa el flujo estrella-final-de-nivel CUANDO el jugador observa los mensajes ENTONCES primero entiende el descarte de estrella y despues entiende que el nivel se completo.
- DADO que se ejecutan las pruebas y builds relevantes CUANDO termina la implementacion ENTONCES los tests pasan, la cobertura del codigo nuevo o modificado alcanza al menos 70% y no hay errores bloqueantes de build.

## Tareas tecnicas

1. Revisar las duraciones centralizadas en `apps/frontend/src/messageTiming.ts` y los locks autoritativos en `apps/backend/src/gameTiming.ts` / `apps/backend/src/index.ts` para identificar todos los mensajes que bloquean interaccion: error, pausa/countdown si aplica, estrella, nivel completado, reparto/transiciones y reinicio si bloquea acciones.
2. Aumentar en 1000 ms las duraciones de mensajes bloqueantes en el helper frontend y en los locks backend correspondientes para que UI y estado autoritativo no se desincronicen.
3. Revisar el modelo `EventOverlay` en `apps/frontend/src/App.tsx` y agregar soporte consistente de subtitulo/descripcion corta para overlays principales sin duplicar copy en JSX.
4. Definir copy final en ingles, breve y claro, tomando como base la intencion del usuario y corrigiendo ingles cuando convenga, por ejemplo: aceptar estrella descarta la carta mas baja de todos, estrella descartando cartas, vida perdida, victoria por conexion total y derrota por conexion insuficiente.
5. Aplicar los subtitulos a los overlays y mensajes principales existentes: propuesta/aceptacion de estrella si se muestra como estado accionable, estrella usada, error de vida, pausa/reconcentracion, nivel completado, victoria, derrota, reinicio y otros overlays bloqueantes actuales.
6. Ajustar el flujo frontend para que el estado de ready/acciones no se habilite mientras exista un overlay bloqueante visible de nivel completado, aunque las cartas del siguiente nivel ya se hayan repartido.
7. Ajustar el flujo backend para que el lock autoritativo de nivel completado/reparto cubra tambien la duracion del mensaje cuando corresponda, evitando que clientes o CPU actuen antes de que el jugador termine de recibir el feedback visual.
8. Revisar el caso especifico donde `resolveStar()` deja el nivel sin cartas y dispara `scheduleLevelCompletionAfterRoundOut()` para garantizar que el evento/overlay de `level-complete` se emite o se muestra despues de terminar el overlay `star-used`.
9. Implementar una estrategia de secuenciacion minima para overlays en frontend, o una espera/lock backend en el flujo de estrella, de forma que `star-used` y `level-complete` no se solapen ni se pisen.
10. Mantener la semantica de negocio existente: la estrella sigue descartando cartas y no las agrega a la pila central; completar el nivel sigue otorgando recompensas y avanzando de nivel igual que antes.
11. Actualizar o agregar pruebas frontend para cubrir nuevas duraciones, subtitulos esperados cuando esten en helpers testeables y bloqueo visual de ready mientras el overlay de nivel completado sigue activo.
12. Actualizar o agregar pruebas backend para cubrir la duracion extendida de locks bloqueantes y/o el delay de nivel completado tras estrella cuando el nivel queda sin cartas.
13. Ejecutar `npm run test:coverage` en `apps/frontend` y `apps/backend`, verificando al menos 70% de cobertura sobre codigo nuevo o modificado.
14. Ejecutar `npm run build` en `apps/frontend` y `apps/backend` para validar TypeScript/build.
15. Si se modifican archivos de codigo, ejecutar `graphify hook-rebuild` al final para mantener actualizado el grafo del proyecto.

## Propuesta de subtitulos

- `game:error-penalty` / overlay `ERROR`: `YOU NOW HAVE ONE LIFE LESS`.
- `game:paused` / overlay `PAUSE REQUESTED`: `READY UP AGAIN WHEN EVERYONE IS FOCUSED`.
- `game:star-proposed` / estado de propuesta activa: `ACCEPT ACTIVATION TO DISCARD EVERYONE'S LOWEST CARD`.
- `star:accept` ya aceptado / esperando al resto: `WAITING FOR EVERYONE TO ACCEPT THE STAR`.
- `game:star-used` / overlay `STAR RESOLVED`: `DISCARDING EVERYONE'S LOWEST CARD`.
- `game:level-complete` / overlay `LEVEL N CLEARED`: `GET READY FOR THE NEXT LEVEL`.
- `game:next-level-ready` / estado de nuevo nivel listo: `READY UP WHEN THE TABLE SETTLES`.
- `game:restarted` / overlay `GAME RESTARTED`: `THE RUN STARTS AGAIN FROM LEVEL ONE`.
- `game:victory` / final `YOU WON`: `YOUR MINDS ARE FULLY CONNECTED`.
- `game:over` / final `YOU LOST`: `THE HIVE STILL NEEDS TO BE CONNECTED`.
- Countdown/reconcentracion antes de jugar: `WAIT FOR THE HIVE TO RELEASE THE NEXT PULSE`.
- Reparto de cartas / bloqueo de dealing: `WAIT UNTIL EVERY CARD IS DEALT`.

Notas de redaccion:

- Usar `EVERYONE'S LOWEST CARD`, no `EVERYONES LOWER CARD`, para ingles correcto y porque la regla descarta la carta mas baja de cada jugador.
- Mantener los subtitulos en mayusculas para consistencia con los titulos actuales de overlays.
- Si un mensaje ya tiene copy principal aleatorio (`MSG.*`), el subtitulo debe ser estable y funcional; el copy principal puede conservar el tono atmosferico.

## Decisiones tomadas

- El alcance se limita a mensajes, subtitulos, duraciones, bloqueos asociados y secuenciacion de overlays; no cambia reglas de juego, scoring, reparto ni recompensas.
- Los subtitulos deben estar en ingles por ahora y pueden mejorar la redaccion propuesta por el usuario siempre que mantengan su intencion funcional.
- Los mensajes bloqueantes deben aumentar exactamente 1000 ms respecto a su valor actual para evitar ajustes arbitrarios de UX.
- El bloqueo de ready/acciones durante mensajes relevantes debe ser autoritativo cuando afecte reglas o CPU, no solo visual en el cliente.
- El caso estrella que completa nivel debe secuenciarse para mostrar primero el descarte por estrella y despues el nivel completado, porque ambos eventos son relevantes y no deben competir visualmente.
- Se respetan las convenciones actuales: frontend monolitico en `App.tsx`, helpers puros testeables (`messageTiming.ts`, `gameUi.ts` u otros si aplica), backend monolitico en `index.ts` y tests con `node:test` + `tsx`.
- No se requieren migraciones ni persistencia nueva porque el estado de salas sigue siendo en memoria.
