## Criterios de aceptacion

- DADO una partida en curso con estrellas disponibles CUANDO un jugador propone usar una estrella ENTONCES al proponente se le muestra un unico boton para retirar la propuesta con icono de estrella y no se le muestran botones de aceptar o rechazar.
- DADO una partida en curso con una propuesta de estrella activa de otro jugador CUANDO un jugador que no propuso ve la interfaz de estrella ENTONCES solo se le muestran los botones `Aceptar estrella` y `Rechazar estrella`.
- DADO una propuesta de estrella activa CUANDO cualquier jugador ve la interfaz relacionada con la propuesta ENTONCES no aparece ningun mensaje sobre la mano del jugador asociado a la estrella.
- DADO una propuesta de estrella activa CUANDO un jugador distinto del proponente pulsa `Rechazar estrella` ENTONCES la propuesta queda cancelada y la partida vuelve al estado de juego normal sin consumir estrella.
- DADO una propuesta de estrella activa CUANDO el proponente pulsa retirar propuesta ENTONCES la propuesta queda cancelada y la partida vuelve al estado de juego normal sin consumir estrella.
- DADO que todos los jugadores requeridos aceptan una estrella y la estrella se activa sin completar nivel ni terminar partida CUANDO termina el mensaje o bloqueo visual de estrella activada ENTONCES la partida queda pausada y todos los jugadores humanos conectados deben volver a hacer ready up para continuar.
- DADO que se produce un error con penalizacion y el error no completa nivel ni termina partida CUANDO termina el mensaje o bloqueo visual del error ENTONCES la partida queda pausada y todos los jugadores humanos conectados deben volver a hacer ready up para continuar.
- DADO que una estrella activada completa el nivel o termina la partida CUANDO se resuelve la estrella ENTONCES se muestran los mensajes correspondientes de estrella y de finalizacion de nivel o partida de forma secuencial, sin introducir una pausa intermedia de ready up.
- DADO que un error con penalizacion completa el nivel o termina la partida CUANDO se resuelve el error ENTONCES se muestran los mensajes correspondientes de error y de finalizacion de nivel o partida de forma secuencial, sin introducir una pausa intermedia de ready up.
- DADO que la partida queda pausada tras estrella o error CUANDO no todos los jugadores humanos conectados han marcado ready ENTONCES no se permite seguir jugando cartas ni proponer/aceptar estrellas.
- DADO que la partida queda pausada tras estrella o error CUANDO todos los jugadores humanos conectados marcan ready ENTONCES se ejecuta el mismo flujo observable de reanudacion/countdown que en una pausa cooperativa existente.

## Tareas tecnicas

1. Revisar el flujo actual de estrella en `apps/backend/src/index.ts` y `apps/frontend/src/App.tsx`, especialmente `star:propose`, `star:accept`, `resolveStarIfEveryoneAccepted()`, `resolveStar()`, el estado de propuesta serializado en `room:update` y los controles renderizados en la UI.
2. Ajustar el modelo/contrato de estrella si hace falta para soportar rechazo y retirada de propuesta de forma explicita, manteniendo el patron Socket.IO con ack opcional `{ ok, error?, ...data }` y el backend como autoridad de estado.
3. Implementar en backend la cancelacion de propuesta de estrella para el proponente y el rechazo para jugadores no proponentes, asegurando que no se consume estrella, se limpian aceptaciones/propuesta y se emite `room:update`/log segun corresponda.
4. Actualizar el frontend monolitico en `apps/frontend/src/App.tsx` para que, cuando exista propuesta de estrella, derive los controles por rol: proponente => un unico boton de retirar con icono de estrella; resto de jugadores => solo `Aceptar estrella` y `Rechazar estrella`.
5. Eliminar de la UI el mensaje no solicitado sobre la mano del jugador en el flujo de estrella, sin cambiar la regla de privacidad: `room:update` no debe exponer manos completas y `player:state` sigue siendo privado por socket.
6. Revisar `resolveStar()`/`resolveStarIfEveryoneAccepted()` y el cierre de nivel para detectar si la estrella deja el nivel/partida sin cartas pendientes o en estado final; usar esa condicion para decidir entre secuencia de fin de nivel/partida o pausa de ready up.
7. Revisar `playCardInRoom()`, `resolveErrorAndDiscard()` y `completeLevelOrGame()` para detectar si la penalizacion por error deja el nivel/partida finalizado; usar esa condicion para decidir entre secuencia de fin de nivel/partida o pausa de ready up.
8. Reutilizar el mecanismo existente de pausa/re-ready (`status` pausado, `ready=false` para jugadores humanos conectados, `player:ready` y `beginRoundCountdown()`) para las pausas posteriores a estrella/error, evitando introducir un segundo sistema de pausa.
9. Coordinar los timers y `interactionLock` existentes para que la pausa posterior a estrella/error ocurra solo despues de terminar el mensaje/bloqueo visual correspondiente, y para que no se puedan jugar cartas ni gestionar estrellas durante el bloqueo o la pausa.
10. Asegurar que la excepcion de finalizacion mantiene mensajes secuenciales: primero estrella/error, luego nivel completado, victoria o derrota, sin exigir ready up cuando el nivel o la partida ya terminaron.
11. Actualizar o crear pruebas unitarias backend para cubrir: retirada/rechazo de propuesta, estrella que pausa tras resolverse, estrella que completa nivel/partida sin pausa, error que pausa tras penalizar y error que completa nivel/partida sin pausa.
12. Actualizar o crear pruebas frontend/helper si se extrae logica testeable para los estados de botones de estrella; si la logica permanece dentro de `App.tsx`, validar manualmente los casos UI por no existir framework de test de componentes en el repo.
13. Ejecutar los tests soportados por paquete (`apps/backend` y `apps/frontend`) mediante el flujo del proyecto, preferentemente dentro de Docker Compose o con los scripts existentes si ya estan disponibles en el contenedor de desarrollo.
14. Actualizar documentacion solo si cambia el contrato observable de eventos Socket.IO o el README queda contradictorio con la nueva semantica; no introducir router, estado global externo, base de datos ni reorganizacion de componentes.

## Decisiones tomadas

- La solicitud se limita a corregir el flujo de estrella, la UI asociada y la pausa posterior a estrella/error; no se amplia el alcance a nuevas reglas de juego ni a redisenos visuales generales.
- La retirada de propuesta es exclusiva del proponente y se representa como un unico boton con icono de estrella; aceptar/rechazar es exclusivo de los demas jugadores.
- Se elimina el mensaje sobre la mano del jugador en la propuesta de estrella porque el usuario indico que no fue pedido.
- Tras estrella activada o error con penalizacion, la partida debe requerir ready up solo si el nivel y la partida siguen en curso.
- Si estrella o error provocan completar nivel, victoria o derrota, se prioriza mostrar los mensajes secuenciales de resolucion y finalizacion sin pausa intermedia.
- Se reutilizara el sistema existente de pausa cooperativa y ready up documentado en la arquitectura, en lugar de crear un mecanismo paralelo.
- Se mantiene la arquitectura actual de aplicaciones monoliticas: backend en `apps/backend/src/index.ts`, frontend en `apps/frontend/src/App.tsx`, estado autoritativo en memoria del backend y privacidad de manos mediante `player:state`.
- No se contemplan migraciones ni cambios de base de datos porque el proyecto no usa persistencia durable.
