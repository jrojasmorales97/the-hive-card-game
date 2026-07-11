## Criterios de aceptacion

- DADO una sala recien creada CUANDO el host entra correctamente ENTONCES se muestra una pantalla intermedia de espera dentro de la sala, no la mesa de juego, con un mensaje visible de que se esta esperando a que el host empiece la partida.
- DADO una sala en fase de lobby CUANDO nuevos jugadores se unen ENTONCES todos los jugadores conectados aparecen listados en la pantalla de espera sin recargar la pagina.
- DADO cualquier jugador dentro del lobby CUANDO pulsa el control de copia del codigo de sala ENTONCES el codigo visible de la sala queda copiado para poder compartirlo.
- DADO una sala en fase de lobby CUANDO se renderiza la lista de jugadores ENTONCES las tarjetas de espera mantienen la estetica actual de contenedores translucidos con borde violeta/neon y muestran tematica de colmena mediante formas hexagonales o disposicion tipo panal.
- DADO una sala en fase de lobby CUANDO el usuario actual no es host ENTONCES no ve controles para expulsar jugadores ni boton habilitado para iniciar la partida.
- DADO una sala en fase de lobby y un host presente CUANDO el host ve una tarjeta de otro jugador ENTONCES aparece un boton `x` sobre el borde de esa tarjeta para expulsarlo.
- DADO una sala en fase de lobby y un host presente CUANDO el host expulsa a otro jugador ENTONCES el jugador expulsado deja de aparecer en la sala para el resto y el expulsado vuelve a la pantalla de acceso con un mensaje explicativo.
- DADO una sala en fase de lobby con menos del minimo de jugadores conectados CUANDO el host intenta iniciar ENTONCES la partida no empieza y se muestra un error observable.
- DADO una sala en fase de lobby con el minimo de jugadores conectados CUANDO el host pulsa el boton inferior de empezar ENTONCES la sala abandona el lobby y entra en partida sin requerir que los jugadores marquen ready previamente.
- DADO una sala que ya no esta en fase de lobby CUANDO un jugador nuevo intenta unirse con el codigo ENTONCES la union se rechaza con un mensaje de que la partida ya empezo.
- DADO un jugador que ya pertenecia a una sala en partida CUANDO se reconecta con el mismo `playerId` ENTONCES entra directamente a la pantalla in-game y no pasa por la pantalla de lobby.
- DADO el inicio de una partida desde el lobby CUANDO la pantalla cambia a in-game ENTONCES la animacion de reparto de cartas empieza aproximadamente un segundo despues de salir del lobby.

## Tareas tecnicas

1. Revisar el flujo actual de sala en `apps/backend/src/index.ts` y `apps/frontend/src/App.tsx`, separando explicitamente los estados visuales `sin sala`, `lobby` e `in-game` sin introducir router, libreria de estado ni nuevos patrones fuera de la arquitectura monolitica actual.
2. Ajustar la logica backend de inicio para que el inicio desde lobby sea host-only y explicito: crear o adaptar un helper de validacion de inicio de lobby basado en sala en `lobby` y minimo de jugadores conectados, manteniendo la logica de `ready` solo para reanudar rondas en `focus`/`paused`.
3. Eliminar el auto-inicio de partida desde `player:ready` cuando la sala esta en lobby, preservando el comportamiento de ready durante foco/pausa de ronda.
4. Endurecer `game:start` para rechazar intentos si el socket no esta en sala, si el jugador no es host, si la sala no esta en lobby, si ya existe partida activa o si no se cumple el minimo de jugadores.
5. Verificar y, si hace falta, ajustar `room:join` para conservar esta regla: jugadores nuevos solo pueden unirse a salas en `lobby`, mientras que jugadores ya existentes pueden reconectar a partidas empezadas con el mismo `playerId`.
6. Implementar un evento Socket.IO de expulsion desde lobby, por ejemplo `room:kick`, con ack `{ ok, error? }`, validando host-only, lobby-only, jugador objetivo existente y prohibicion de autoexpulsion del host.
7. En la expulsion, limpiar indices backend (`rooms`, `playerRoom`, `socketPlayer`) para el jugador objetivo, sacarlo de la sala Socket.IO, emitir actualizacion al resto de la sala y notificar al socket expulsado con un evento server-to-client especifico para que pueda limpiar su estado local.
8. Actualizar el snapshot/acciones disponibles si aplica para que el frontend pueda distinguir `canStartGame`, `canKickPlayers` o razones de bloqueo sin duplicar reglas criticas del backend.
9. Crear en `App.tsx` una rama de render para `room.status === 'lobby'` antes del layout de mesa, reutilizando estado local existente y componentes inline acordes a la convencion de archivo unico.
10. Construir la pantalla de espera con codigo de sala destacado y copiable, copy feedback accesible, mensaje de espera al host, lista de jugadores, marca visual de host y boton inferior de empezar visible/habilitado solo para el host cuando corresponda.
11. Disenar las `player-waiting-card` y slots vacios con tematica de colmena en `apps/frontend/src/styles.css`, usando bordes neon violeta/cian/rosa, translucidez y fondo hexagonal visible; asegurar respuesta en mobile y desktop dentro de la estetica actual.
12. Wirear el boton `x` de cada tarjeta no propia al evento de expulsion, mostrando errores de ack cuando falle y ocultandolo para no-host, para el propio host y fuera de lobby.
13. Manejar en frontend el evento de jugador expulsado limpiando `room`, `hand`, logs/overlays y `th:lastRoomCode`, evitando auto-rejoin inmediato y mostrando un mensaje de expulsion en la pantalla de acceso.
14. Ajustar `startGame()` en frontend para operar desde la pantalla de lobby y reflejar errores de inicio, sin depender de botones de ready previos.
15. Introducir un retardo local de 1000 ms para la primera animacion de reparto cuando se detecte transicion propia de `lobby` a `in-game`, sin aplicar ese retardo a reconexiones directas a partida ni a repartos de niveles posteriores.
16. Actualizar o crear tests backend con `node:test` para cubrir: inicio host-only sin ready previo, rechazo de jugador nuevo en partida empezada, reconexion permitida de jugador existente y expulsion host-only/lobby-only.
17. Actualizar o crear tests frontend de helpers puros si se extrae logica para el retardo inicial, disponibilidad de acciones de lobby o limpieza tras expulsion; mantenerlos en el patron actual de tests unitarios sin E2E.
18. Ejecutar la verificacion soportada por el repo: tests de backend y frontend desde sus paquetes y una prueba manual con `docker compose up --build` para validar crear sala, unirse, copiar codigo, expulsar, empezar y reconectar.

## Decisiones tomadas

- La pantalla de espera se implementara dentro del flujo actual de `App.tsx` y `styles.css`, sin React Router, sin carpeta de componentes nueva y sin libreria externa de estado.
- El backend seguira siendo la autoridad de reglas de sala; el frontend solo mostrara controles segun snapshot/acciones y siempre tratara el ack del servidor como fuente final.
- El inicio de partida desde lobby sera exclusivamente por boton del host; el ready de lobby deja de disparar auto-inicio y se reserva para los estados de preparacion/reanudacion de ronda ya existentes.
- La restriccion “no unirse a partidas empezadas” aplica a jugadores nuevos; la reconexion con el mismo `playerId` es una excepcion deliberada para cumplir el flujo de reconexion in-game.
- El boton de copia del lobby copiara el codigo visible de sala; los mecanismos de enlace compartible existentes podran mantenerse fuera de esta pantalla si ya se usan en otros estados.
- La expulsion sera una accion destructiva limitada al lobby: no se permitira expulsar durante una partida empezada ni autoexpulsarse como host.
- El retardo de 1000 ms del reparto inicial sera client-side y asociado a la transicion visual lobby -> in-game para no modificar reglas de timing autoritativas del backend.
- No se requieren migraciones ni persistencia nueva, porque el proyecto mantiene salas y jugadores en memoria mediante Maps globales.
