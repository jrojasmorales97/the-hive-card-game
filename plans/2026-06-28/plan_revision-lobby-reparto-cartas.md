## Criterios de aceptacion

- DADO que estoy en el lobby de una sala CUANDO visualizo botones, pills, textos y contenedores ENTONCES todos mantienen una misma familia visual alineada con la UI in-game existente.
- DADO que estoy en el lobby CUANDO veo acciones como copiar codigo/URL, salir y empezar ENTONCES los botones tienen jerarquia, radios, espaciados, estados hover/disabled y pesos tipograficos consistentes entre si.
- DADO que estoy en el lobby CUANDO veo textos de titulo, subtitulo, nombres de jugadores, footnotes y labels ENTONCES usan tamanos, mayusculas, letter-spacing y colores coherentes y legibles en desktop y mobile.
- DADO que estoy en el lobby CUANDO veo contenedores y pills ENTONCES sus fondos, bordes, sombras, padding y separaciones siguen un criterio unificado y no duplican estilos divergentes innecesarios.
- DADO que el host inicia una partida desde el lobby en nivel 1 CUANDO comienza la partida ENTONCES el reparto inicial de cartas se visualiza antes de permitir la interaccion normal con la mano.
- DADO que la partida pasa del lobby al nivel 1 CUANDO se reciben `room:update` y `player:state` iniciales ENTONCES el cliente no salta directamente a cartas ya asentadas sin animacion de reparto.
- DADO que se realizan los ajustes visuales y del reparto CUANDO se ejecutan las pruebas y validaciones del frontend ENTONCES TypeScript y las pruebas unitarias relevantes pasan sin errores.

## Tareas tecnicas

1. Revisar en `apps/frontend/src/App.tsx` y `apps/frontend/src/styles.css` el estado actual de la vista de lobby, identificando duplicaciones o divergencias entre botones, pills, textos, contenedores y estilos in-game como `topbar-pill`, `command-button`, `player-corner` y paneles.
2. Definir una pequena normalizacion de estilos en CSS sin introducir router, libreria de estado ni sistema de componentes nuevo, respetando la arquitectura monolitica actual del frontend.
3. Unificar estilos de botones del lobby: Start, Exit, copy URL/code y estados disabled/hover/focus, tomando como referencia los patrones existentes de `command-button` y `topbar-pill`.
4. Unificar estilos de textos del lobby: titulo, subtitulo, nombres, badges/footnotes y mensajes secundarios, asegurando legibilidad con nombres largos y en viewports pequenos.
5. Unificar contenedores y pills del lobby: panel principal, fila de pills, hex-grid, tarjetas de jugador y empty seats, eliminando reglas CSS obsoletas si ya no se usan.
6. Revisar el flujo de transicion lobby -> in-game en `App.tsx`, especialmente los estados/refs que controlan animaciones de reparto, deteccion de primera mano y aplicacion de snapshots.
7. Localizar por que el reparto de cartas del nivel 1 no se visualiza despues del lobby: comparar el flujo inicial de `game:started`, `room:update`, `player:state`, locks visuales y cualquier retardo/flag usado para animar nuevas manos.
8. Ajustar la logica frontend para que el primer reparto tras salir del lobby active la misma animacion visual que los repartos posteriores, sin cambiar las reglas autoritativas del backend.
9. Verificar que el cambio no rompe reconexion, resync, modo CPU ni reparto de niveles posteriores; si algun flujo debe saltar animacion por resync/reconexion, dejarlo controlado explicitamente.
10. Actualizar o ampliar helpers puros y tests en `apps/frontend/src/gameUi.ts`, `apps/frontend/src/lobbyUi.ts` y sus archivos `.test.ts` si la logica nueva puede aislarse fuera de `App.tsx`.
11. Ejecutar `npx tsc -p tsconfig.json --noEmit` en `apps/frontend` y las pruebas unitarias/cobertura relevantes del frontend.
12. Probar manualmente con Docker Compose el flujo crear sala -> lobby -> Start -> reparto nivel 1, ademas de responsive en desktop y mobile.

## Decisiones tomadas

- El alcance se limita al frontend salvo que al investigar el reparto inicial aparezca una causa demostrable en el contrato Socket.IO; no se cambiaran reglas de negocio del backend sin evidencia.
- Se mantendra la arquitectura actual de single-file app: `App.tsx` para UI/estado principal y helpers puros solo cuando aporten testabilidad.
- La unificacion visual debe reutilizar patrones CSS existentes antes de crear nuevas variantes, para evitar otra capa de estilos divergentes.
- El copy del lobby debe seguir copiando URL con codigo de sala y no solo el codigo, porque es el comportamiento esperado tras los ajustes recientes.
- La animacion del reparto nivel 1 debe resolverse en la transicion visual del cliente, no retrasando artificialmente el inicio autoritativo de la partida en backend salvo necesidad comprobada.
- No se introduciran migraciones ni configuracion nueva; no hay base de datos ni persistencia durable en el proyecto.
