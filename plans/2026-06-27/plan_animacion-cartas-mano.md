## Criterios de aceptacion

- DADO que el jugador local tiene una carta primaria jugable CUANDO juega esa carta ENTONCES la carta animada sale visualmente desde la carta primaria actual de su mano hacia la pila central.
- DADO que otro jugador o CPU juega una carta CUANDO la carta aparece en la pila central ENTONCES la carta animada sigue saliendo desde el player corner correspondiente a ese jugador.
- DADO que la carta primaria del jugador local sale hacia la pila CUANDO las cartas restantes reorganizan la mano ENTONCES cada carta avanza de posicion en posicion hasta ocupar su nuevo slot sin usar efecto flip.
- DADO que la mano del jugador local tiene suficientes cartas para usar la disposicion con curva CUANDO se juega una carta ENTONCES las cartas restantes recorren la curva segun su nuevo slot y no saltan directamente a posiciones finales incorrectas.
- DADO que hay mas jugadores y el maximo de cartas en mano no activa la disposicion con curva CUANDO se juega una carta ENTONCES la reorganizacion de la mano ocurre solo sobre los slots visibles aplicables a esa cantidad maxima de cartas.
- DADO una mano como las referencias `screenshot-2026-06-27_14-09-28.png`, `screenshot-2026-06-27_14-09-47.png`, `screenshot-2026-06-27_14-09-53.png` y `screenshot-2026-06-27_14-10-03.png` CUANDO se juegan cartas consecutivas ENTONCES la carta primaria pasa de 11 a 12, luego a 45 y luego a 47, mientras las cartas de cola avanzan respetando el orden visual mostrado.
- DADO que una estrella activada descarta la carta mas baja del jugador local CUANDO se muestra la animacion de descarte ENTONCES esa carta sale desde la esquina inferior derecha de la pantalla con un giro leve en eje Z antes de desaparecer.
- DADO que la animacion local de descarte por estrella termina CUANDO el cliente notifica al backend que su animacion ha finalizado ENTONCES el backend puede aplicar el descarte y, si ya no quedan cartas en ninguna mano, emitir despues el mensaje de nivel completado.
- DADO que un cliente tarda demasiado o se desconecta durante la animacion de descarte por estrella CUANDO vence el timeout de seguridad del backend ENTONCES la partida no queda bloqueada indefinidamente y el descarte pendiente se resuelve de forma autoritativa.

## Tareas tecnicas

1. Revisar el flujo actual de render de mano en `apps/frontend/src/App.tsx`, especialmente `primaryCard`, `queueCards`, `queueSlots`, `queueTopRow`, `queueCurveSlot`, `queueBottomRow` y el render de `.primary-card`/`.queue-card`.
2. Revisar el CSS actual en `apps/frontend/src/styles.css` para `.center-pile`, `.card.pile`, `.primary-card`, `.queue-card`, `.command-queue`, filas de cola y breakpoints responsive.
3. Extraer o crear un helper puro frontend para calcular slots visuales de mano a partir de cartas ordenadas, maximo de nivel y disponibilidad de curva, manteniendo la convencion actual: carta primaria grande separada, hasta cinco cartas en fila superior, slot curvo opcional y fila inferior si aplica.
4. Agregar pruebas unitarias del helper de slots para escenarios sin curva y con curva, incluyendo casos equivalentes a las imagenes de referencia donde la mano avanza de 11 a 12, 12 a 45 y 45 a 47.
5. Implementar medicion de posiciones DOM para la carta primaria, slots de cola y centro de pila usando refs en `App.tsx`, siguiendo el patron actual de medicion usado para `pileEntryMap` y evitando librerias externas.
6. Cambiar el origen de animacion de cartas jugadas por el jugador local: si `pileHistory` indica que el `playerId` de la nueva carta es el jugador local, usar la posicion medida de la carta primaria como origen; si no, conservar el origen desde `playerCornerMap`/player corner.
7. Implementar una capa temporal de animacion para la carta local jugada que permita verla salir desde la primaria hacia la pila aunque la mano privada ya haya llegado actualizada por `player:state`.
8. Implementar animacion de reordenacion de mano sin flip mediante transformaciones/transiciones entre slots anteriores y nuevos, cuidando que cada carta avance por slots intermedios cuando el slot curvo exista.
9. Asegurar que las cartas fantasma/slots vacios acompanen el layout sin recibir animaciones erroneas ni desplazar cartas visibles de forma brusca.
10. Ajustar estilos CSS para que la reorganizacion de mano, el vuelo de carta local y el vuelo de cartas rivales no entren en conflicto con animaciones existentes de reparto, estrella, limpieza de pila ni overlays.
11. Revisar el flujo actual de estrella en backend (`resolveStarIfEveryoneAccepted`, `resolveStar`, `finalizeStarResolution`) para sustituir la espera fija por una espera basada en confirmacion de animacion cuando haya clientes humanos afectados.
12. Agregar un evento Socket.IO nuevo y acotado, por ejemplo `star:discard-animation-complete`, que el frontend emita tras terminar la animacion local de descarte por estrella; el backend debe tratarlo solo como confirmacion visual, no como autoridad sobre que carta descartar.
13. En backend, guardar el descarte pendiente de estrella calculado autoritativamente, marcar como resueltos automaticamente los descartes de CPU o jugadores sin socket activo, y aplicar el descarte real cuando todos los clientes humanos afectados confirmen o venza un timeout de seguridad.
14. En frontend, cuando `game:star-used` incluya una carta descartada del jugador local, disparar la animacion desde la esquina inferior derecha con rotacion leve en eje Z y emitir `star:discard-animation-complete` al finalizar.
15. Mantener compatibilidad con reconexion: si un cliente reconecta durante una estrella pendiente debe recibir estado consistente, no debe poder duplicar confirmaciones ni provocar doble descarte.
16. Actualizar helpers de acciones privadas si es necesario para mantener bloqueadas las interacciones durante animaciones/transiciones autoritativas de estrella.
17. Agregar pruebas unitarias backend para la logica pura de confirmaciones/timeout de descarte pendiente de estrella, cubriendo jugadores humanos, CPU/desconectados y resolucion al completar nivel.
18. Agregar pruebas unitarias frontend para calculo de slots, deteccion de origen local frente a rival y cualquier helper de animacion/reordenacion que se extraiga de `App.tsx`.
19. Ejecutar pruebas de frontend y backend con los scripts existentes o, si el glob de `npm test` falla dentro de Docker, con el equivalente `node --import tsx --test src/*.test.ts` documentando el comando usado.
20. Ejecutar cobertura con `--experimental-test-coverage` en los paquetes afectados y verificar al menos 70% de cobertura sobre helpers nuevos o modificados.
21. Verificar manualmente en Docker Compose una partida de 4 jugadores con nivel alto como en las imagenes y una partida con mas jugadores donde no haya curva, comprobando origen de carta local, origen de rivales, avance de mano y descarte por estrella.

## Decisiones tomadas

- La carta jugada por el jugador local saldra desde la carta primaria actual porque es la menor de la mano y la unica jugable por regla de negocio.
- Las cartas jugadas por otros jugadores conservaran el comportamiento actual de salir desde sus player corners.
- La reorganizacion de la mano se hara sin efecto flip; las cartas se desplazaran entre posiciones visibles y, cuando exista curva, avanzaran siguiendo la curva.
- La curva solo aplica cuando el layout actual de mano la necesita; con mas jugadores y menor maximo de cartas en mano no se forzara curva.
- Las imagenes de referencia ubicadas en `plans/2026-06-27/` son parte del criterio visual para el avance de posiciones de la mano.
- El backend seguira siendo la autoridad del descarte de estrella; el nuevo aviso del frontend indicara que termino la animacion, no que el cliente decide que carta se descarta.
- La resolucion de estrella debera tener timeout de seguridad para evitar bloqueos por clientes desconectados, recargas o perdida de eventos.
- Se mantendra el stack actual sin librerias de animacion externas: React, CSS transitions/animations, refs DOM y helpers TypeScript testeables.
