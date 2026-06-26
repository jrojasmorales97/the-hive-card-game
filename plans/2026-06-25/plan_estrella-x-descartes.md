## Criterios de aceptacion

- DADO que una estrella se resuelve y descarta la carta mas baja de uno o mas jugadores CUANDO se muestra el mensaje visual de estrella activada ENTONCES cada carta descartada aparece con una X roja parpadeante superpuesta y no se muestra el texto `OUT`.
- DADO que mi carta fue descartada por una estrella CUANDO la carta se mantiene temporalmente visible en mi mano ENTONCES la carta conserva su apariencia base y solo la X roja superpuesta parpadea.
- DADO que el mensaje de estrella activada contiene descartes de varios jugadores CUANDO la UI cambia a layout de dos columnas ENTONCES los nombres de jugadores siguen siendo legibles y no se cortan por falta de ancho.
- DADO que hay nombres largos o muchos descartes en el mensaje de estrella activada CUANDO se renderiza el listado ENTONCES el layout distribuye carta, X y nombre sin solapamientos visuales.
- DADO que la estrella se activa durante una partida ENTONCES se mantiene la semantica existente de descarte: las cartas descartadas por estrella no se agregan a la pila central ni se tratan como cartas jugadas manualmente.
- DADO que se ejecutan las pruebas y build del frontend CUANDO se completa la implementacion ENTONCES los tests relevantes pasan y el build termina sin errores bloqueantes.

## Tareas tecnicas

1. Revisar la implementacion actual de la UI de estrella en `apps/frontend/src/App.tsx`, `apps/frontend/src/styles.css` y `apps/frontend/src/starUi.ts` para ubicar todos los usos visuales de `OUT`, el listado de descartes y la carta descartada temporal en la mano.
2. Ajustar la representacion del listado de descartes de estrella para sustituir el texto `OUT` por un indicador visual reutilizable de X roja superpuesta sobre la minicarta.
3. Ajustar la representacion de la carta descartada en la mano del jugador para que la carta no parpadee y el parpadeo quede limitado al indicador de X roja superpuesta.
4. Revisar y modificar los estilos del overlay de estrella en `apps/frontend/src/styles.css` para soportar dos columnas sin recortar nombres, contemplando nombres largos, hasta 8 jugadores y tamanos de pantalla pequenos.
5. Mantener o extender helpers puros en `apps/frontend/src/starUi.ts` para decidir layout y/o clases visuales de forma testeable, evitando mover logica de UI compleja directamente a JSX si puede aislarse.
6. Actualizar o agregar pruebas en `apps/frontend/src/starUi.test.ts` para cubrir la decision de layout de dos columnas y los casos limite de cantidad de descartes/nombres cuando la logica sea helperizada.
7. Ejecutar `npm run test:coverage` en `apps/frontend` y corregir fallos relacionados con los cambios.
8. Ejecutar `npm run build` en `apps/frontend` y verificar que no existan errores bloqueantes.
9. Si se modifican archivos de codigo, ejecutar `graphify hook-rebuild` al final para mantener el grafo actualizado.

## Decisiones tomadas

- El alcance se limita al frontend visual de estrella activada y al layout asociado; no se cambian reglas backend, contrato Socket.IO ni semantica de descarte por estrella.
- Se reemplaza completamente el texto `OUT` por una X roja parpadeante como lenguaje visual unico para descartes por estrella.
- En la mano del jugador, el efecto de parpadeo pertenece a la X superpuesta y no a la carta completa, para evitar confundir descarte visual con interaccion de carta.
- La solucion de nombres cortados queda a criterio de implementacion, priorizando legibilidad en dos columnas y compatibilidad con hasta 8 jugadores.
- Se respeta la arquitectura actual: frontend monolitico en `App.tsx`, estilos en `styles.css` y logica pura testeable en helpers como `starUi.ts` cuando aplique.
- No se requieren migraciones ni cambios de configuracion porque el estado es en memoria y el cambio es puramente de presentacion.
