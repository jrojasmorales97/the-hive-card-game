## Criterios de aceptacion

- DADO que una partida esta en fase de juego y hay una propuesta de estrella aceptada por todos los participantes activos, CUANDO la estrella se resuelve, ENTONCES se descarta la carta menor de cada jugador con cartas sin dejar esas cartas como cartas jugadas en el centro de la pila.
- DADO que la estrella descarta cartas menores, CUANDO se actualiza el estado publico de la sala, ENTONCES la pila visible conserva solo las cartas jugadas manualmente y no muestra como ultima carta ninguna carta descartada por estrella.
- DADO que una estrella descarta cartas y aun quedan cartas en manos de jugadores, CUANDO continua la ronda, ENTONCES la validacion de futuras jugadas se calcula contra las manos restantes sin verse afectada por una carta descartada por estrella en la pila.
- DADO que una estrella descarta las ultimas cartas restantes del nivel, CUANDO termina la resolucion de la estrella, ENTONCES se mantiene el flujo existente de cierre de nivel, recompensa, siguiente nivel, victoria o derrota segun corresponda.
- DADO que la estrella fue usada, CUANDO se muestran logs, overlays o mensajes de sala, ENTONCES debe quedar claro que las cartas fueron descartadas por estrella y no jugadas como cartas normales.
- DADO que la estrella fue usada, CUANDO aparece el mensaje de estrella activada, ENTONCES debe mostrarse un mensaje muy visual con el nombre de cada jugador, una minicarta que representa su carta descartada y el texto `OUT`.
- DADO que se muestra una minicarta de descarte por estrella, CUANDO se renderiza dentro del mensaje de estrella activada, ENTONCES debe ser similar visualmente al componente de carta existente, mas pequena y sin numeros en las esquinas.
- DADO que el mensaje de estrella activada esta visible, CUANDO una carta va a ser descartada de la mano de un jugador, ENTONCES esa carta debe parpadear en su mano mientras dura el mensaje y desaparecer al terminar el mensaje.
- DADO que el mensaje de estrella activada lista descartes de mas de 6 jugadores, CUANDO se renderiza la lista de jugadores y cartas descartadas, ENTONCES debe organizarse en dos columnas compactas para evitar scroll.
- DADO que el mensaje de estrella activada lista descartes de 6 jugadores o menos, CUANDO se renderiza la lista, ENTONCES debe mantenerse compacta en una sola columna o layout equivalente sin requerir scroll.
- DADO que existe scoring final de sincronizacion, CUANDO se calculan resultados al final de la partida, ENTONCES las cartas descartadas por estrella no cuentan como jugadas manuales ni alteran la pila usada para representar cartas jugadas.
- DADO que hay jugadores CPU en modo desarrollo, CUANDO aceptan automaticamente o participan en una estrella, ENTONCES el descarte por estrella se comporta igual para humanos y CPU.

## Tareas tecnicas

1. Revisar el flujo actual de estrella en `apps/backend/src/index.ts`, especialmente `resolveStarIfEveryoneAccepted()` y `resolveStar()`, confirmado por Graphify como zona relevante del bug.
2. Cambiar la semantica de `resolveStar()` para que retire de cada mano la carta menor correspondiente sin insertar esas cartas en `game.pile` como cartas jugadas visibles.
3. Revisar si `pileHistory` debe seguir registrando los descartes de estrella con `source: 'star'` o si conviene separarlos de la historia de jugadas. Mantener compatibilidad con el scoring actual, que ya filtra jugadas manuales en `apps/backend/src/finalScoring.ts`.
4. Si se conserva trazabilidad de descartes por estrella, ajustar el modelo para distinguir claramente descarte de carta jugada: por ejemplo con un campo `source: 'star'` ya existente, un nuevo log dedicado, o una estructura separada si la UI no debe interpretarlo como pila jugada.
5. Actualizar los eventos/logs emitidos por `resolveStarIfEveryoneAccepted()` para que el mensaje y payload reflejen descarte por estrella, no cartas jugadas en el centro.
6. Incluir en el payload de estrella usada la informacion necesaria para la UI visual: jugador, nombre de jugador y carta descartada por cada participante afectado.
7. Verificar el contrato serializado en `serializeRoom()` para asegurar que el frontend no recibe cartas descartadas por estrella dentro de `game.pile` ni las pinta como centro de pila.
8. Revisar `apps/frontend/src/App.tsx` para localizar cualquier renderizado o animacion que trate `pileHistory` con `source: 'star'` como carta jugada en el centro, y ajustar la UI si hace falta para mostrarlo como descarte/log sin contaminar la pila visible.
9. Diseñar el overlay/mensaje de estrella activada en `apps/frontend/src/App.tsx` usando el evento de estrella para mostrar una lista compacta de descartes con nombre de jugador, minicarta y texto `OUT`.
10. Reusar el estilo visual del componente de carta existente para crear la minicarta de descarte, ajustando dimensiones y ocultando numeros de esquina para que funcione como representacion compacta.
11. Implementar el layout compacto de descartes: hasta 6 jugadores en una columna o layout equivalente sin scroll; mas de 6 jugadores en dos columnas para mantener el mensaje visible.
12. Coordinar el timing del overlay de estrella con el estado de mano privada del jugador para que la carta descartada parpadee mientras el mensaje esta visible y desaparezca al finalizar el mensaje.
13. Revisar si hace falta retrasar o fasear la actualizacion visual de la mano en frontend para poder mostrar el parpadeo antes de retirar la carta, sin romper el estado autoritativo recibido por `player:state`.
14. Añadir o ajustar pruebas unitarias de backend para cubrir que resolver estrella elimina la menor carta de cada jugador, reduce estrellas, no incrementa `pile` con esas cartas, expone payload de descartes y dispara cierre de nivel si ya no quedan cartas.
15. Añadir o ajustar pruebas de helpers frontend si se extrae logica pura para layout de descartes, deteccion de cartas parpadeantes o transformacion del payload de estrella a modelo de UI.
16. Ejecutar la verificacion disponible del backend con `npm run test` dentro de `apps/backend` o mediante el flujo Docker si se requiere mantener el entorno soportado.
17. Ejecutar la verificacion disponible del frontend con `npm run test` dentro de `apps/frontend` o mediante el flujo Docker si se requiere mantener el entorno soportado.
18. Validar manualmente con Docker Compose una partida usando estrella: proponer, aceptar todos, comprobar que las cartas menores parpadean en mano, el overlay muestra nombre + minicarta + `OUT`, las cartas desaparecen al terminar el mensaje, no aparecen como ultima carta en el centro y la partida continua correctamente.
19. Validar manualmente una sala de mas de 6 jugadores o equivalente controlado para confirmar que la lista de descartes usa dos columnas y no requiere scroll.
20. Si el cambio altera el contrato visible de estrella, actualizar la documentacion minima relacionada (`business.md` o `README.md`) para corregir la descripcion actual de estrella como cartas "jugadas automaticamente" y reflejar que son descartadas.

## Decisiones tomadas

- La estrella no debe jugar cartas en el centro de la pila; debe descartar la carta menor de cada jugador.
- El objetivo del bugfix es preservar la regla de orden ascendente de la pila visible: ninguna carta descartada por estrella debe quedar como carta jugada que pueda aparentar ser mayor que cartas aun en mano.
- La correccion debe centrarse en el backend porque el estado autoritativo y la resolucion de estrella viven en `apps/backend/src/index.ts`.
- El frontend debe ajustarse para representar la estrella como descarte visual, no como jugada en pila central.
- Se mantiene el flujo de consenso existente de `star:propose` y `star:accept`; el bug reportado afecta a la resolucion de la estrella, no a la votacion.
- No se introduce persistencia ni cambios de arquitectura fuera del flujo actual en memoria.
- Supuesto adoptado: las cartas descartadas por estrella pueden seguir siendo trazables para logs o historial, siempre que no se mezclen con la pila visible de cartas jugadas ni alteren la continuidad de la ronda.
- El mensaje de estrella activada debe ser deliberadamente visual y compacto: nombre de jugador, minicarta y `OUT` por descarte.
- La minicarta de descarte reutiliza el lenguaje visual de carta existente, pero con menor tamano y sin numeros en las esquinas.
- Para mas de 6 jugadores, la lista de descartes se divide en dos columnas para evitar scroll.
- Se asume que el parpadeo de la carta en mano puede requerir una fase visual local en frontend antes de aplicar la desaparicion definitiva recibida desde el estado autoritativo.
