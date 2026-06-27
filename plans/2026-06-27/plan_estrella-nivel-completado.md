## Criterios de aceptacion

- DADO una partida en curso con una estrella disponible y cartas restantes en las manos CUANDO todos los jugadores aceptan usar la estrella ENTONCES se muestra primero el mensaje/overlay de estrella activada durante su duracion completa.
- DADO que las cartas descartadas por la estrella son las ultimas cartas restantes del nivel CUANDO termina el mensaje/overlay de estrella activada ENTONCES el nivel se completa y se muestra despues el mensaje/overlay de nivel completado.
- DADO que una estrella esta resolviendose CUANDO el mensaje/overlay de estrella activada aun no ha terminado ENTONCES las cartas afectadas por la estrella no se consideran descartadas para cerrar el nivel.
- DADO que una estrella esta resolviendose CUANDO un jugador intenta jugar carta, proponer otra estrella o interactuar durante la transicion ENTONCES la accion queda bloqueada hasta que finalice la resolucion de la estrella.
- DADO que la estrella descarta cartas pero aun quedan cartas en el nivel CUANDO termina el mensaje/overlay de estrella activada ENTONCES la partida continua en el mismo nivel sin mostrar mensaje de nivel completado.
- DADO que se usa una estrella CUANDO se actualiza el estado publico y privado de la sala ENTONCES ningun cliente recibe manos privadas de otros jugadores y cada jugador ve su propia mano consistente con el momento de resolucion.

## Tareas tecnicas

1. Revisar el flujo actual en `apps/backend/src/index.ts` alrededor de `resolveStarIfEveryoneAccepted()`, `resolveStar()` y `scheduleLevelCompletionAfterRoundOut()` para confirmar donde se descartan cartas, se emite `game:star-used` y se agenda `game:level-complete`.
2. Separar la resolucion de estrella en dos fases de backend: una fase inmediata de activacion/anuncio que calcula una previsualizacion de las cartas afectadas y emite `game:star-used`, y una fase diferida que aplica el descarte real cuando termina el bloqueo/mensaje de estrella.
3. Mantener un bloqueo de interaccion con razon `star` durante la fase diferida usando la duracion existente de estrella, para evitar jugadas, propuestas o cambios de estado que alteren las cartas antes del descarte real.
4. Ajustar la mutacion de estado para que `room.game.stars` y `room.game.starProposal` se actualicen al activar la estrella, pero las manos de los jugadores no se modifiquen hasta finalizar el mensaje de estrella.
5. Al finalizar la fase diferida, descartar las cartas previstas, emitir los logs `game:discard` correspondientes, enviar `room:update`/`player:state` y solo entonces evaluar `countRemainingCards(room) === 0` para llamar a `scheduleLevelCompletionAfterRoundOut()`.
6. Asegurar que los temporizadores diferidos validen que la sala y la partida siguen siendo las mismas antes de aplicar descartes, siguiendo el patron existente de `setTimeout` defensivo usado en cambios de nivel.
7. Revisar el frontend en `apps/frontend/src/App.tsx`, `apps/frontend/src/levelFlow.ts` y `apps/frontend/src/messageTiming.ts` para confirmar que `game:level-complete` no reemplaza el overlay de `game:star-used` y que el retardo por overlay activo sigue funcionando con el nuevo orden de eventos.
8. Agregar o actualizar pruebas unitarias backend para cubrir que una estrella que elimina las ultimas cartas no completa el nivel hasta que termina la resolucion de estrella, y que mientras tanto las cartas siguen en las manos.
9. Agregar o actualizar pruebas frontend de helpers de timing si cambia la coordinacion entre duracion de estrella y overlay de nivel completado.
10. Ejecutar la suite de pruebas de backend y frontend dentro del flujo soportado por Docker Compose o mediante los scripts existentes de cada paquete, sin introducir migraciones ni configuracion nueva salvo que las pruebas lo requieran.
11. Verificar manualmente el escenario con una partida donde una estrella descarta las ultimas cartas del nivel: debe verse primero estrella activada y despues nivel completado.

## Decisiones tomadas

- El comportamiento solicitado se implementara retrasando el descarte real de cartas de estrella hasta que termine el mensaje/bloqueo de estrella, no solo retrasando visualmente el overlay de nivel completado.
- La autoridad de reglas seguira en el backend; el frontend solo reflejara eventos y overlays recibidos por Socket.IO.
- Se mantendra la arquitectura actual de archivos monoliticos: backend en `apps/backend/src/index.ts` y frontend principal en `apps/frontend/src/App.tsx`, con helpers puros existentes si hace falta tocar timing.
- No se introduce base de datos, migracion ni persistencia nueva; el estado seguira en memoria dentro de las estructuras actuales de sala.
- La duracion usada para diferir el descarte debe alinearse con la duracion existente de resolucion/overlay de estrella para evitar nuevas desincronizaciones.
- Se asume que consumir la estrella y limpiar la propuesta al activarla es correcto, aunque el descarte de cartas se aplique al finalizar el mensaje.
