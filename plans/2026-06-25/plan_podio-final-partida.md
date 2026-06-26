## Criterios de aceptacion

- DADO que una partida termina en victoria, CUANDO se muestra el resumen final de scores, ENTONCES la disposicion visual debe imitar el patron compacto usado en el mensaje de activacion de estrella.
- DADO que una partida termina en derrota, CUANDO se muestra el resumen final de scores, ENTONCES la disposicion visual debe imitar el patron compacto usado en el mensaje de activacion de estrella.
- DADO que el resumen final contiene 6 jugadores o menos, CUANDO se renderizan los scores, ENTONCES deben mostrarse en una sola columna o layout compacto equivalente sin requerir scroll.
- DADO que el resumen final contiene mas de 6 jugadores, CUANDO se renderizan los scores, ENTONCES deben distribuirse en dos columnas para evitar scroll innecesario.
- DADO que existe un ranking final, CUANDO se muestra el jugador en primera posicion, ENTONCES debe destacarse como oro e incluir una corona visible.
- DADO que existe un ranking final con al menos dos jugadores, CUANDO se muestra el jugador en segunda posicion, ENTONCES debe destacarse como plata de forma visualmente diferenciada.
- DADO que existe un ranking final con al menos tres jugadores, CUANDO se muestra el jugador en tercera posicion, ENTONCES debe destacarse como bronce de forma visualmente diferenciada.
- DADO que se muestran jugadores fuera del podio, CUANDO se renderizan sus scores, ENTONCES deben mantener una presentacion legible y menos prominente que oro, plata y bronce.
- DADO que el usuario juega en mobile o desktop, CUANDO aparece el resumen final con muchos jugadores, ENTONCES nombres, puntuaciones y badges de podio deben seguir siendo legibles sin romper el overlay de victoria o derrota.

## Tareas tecnicas

1. Revisar el renderizado actual del resumen final en `apps/frontend/src/App.tsx`, especialmente los overlays de `victory` y `game-over` que usan `finalResults`.
2. Revisar los estilos actuales de scoreboard final en `apps/frontend/src/styles.css` para identificar las clases existentes y minimizar cambios.
3. Crear o reutilizar un helper puro en frontend para decidir si el ranking final debe usar dos columnas, siguiendo el mismo umbral que el overlay de estrella: mas de 6 elementos.
4. Crear o reutilizar un helper puro para clasificar el podio por posicion: oro para indice 0, plata para indice 1, bronce para indice 2 y sin podio para el resto.
5. Añadir pruebas unitarias para los helpers de layout de ranking final y clasificacion de podio.
6. Ajustar `apps/frontend/src/App.tsx` para aplicar una clase de dos columnas al contenedor de scores cuando `finalResults.length > 6`.
7. Ajustar `apps/frontend/src/App.tsx` para marcar cada fila de score con su clase de podio segun posicion.
8. Añadir en la primera posicion un icono visual de corona usando el set de iconos ya usado por la app, manteniendo accesibilidad razonable con texto o `aria-label` cuando aplique.
9. Ajustar estilos en `apps/frontend/src/styles.css` para que el scoreboard final tenga una composicion compacta similar al mensaje de estrella activada: filas compactas, dos columnas opcionales y espaciado controlado.
10. Definir estilos diferenciados para oro, plata y bronce, asegurando contraste suficiente y que el oro con corona sea claramente el primer puesto.
11. Verificar que los overlays de victoria y derrota reutilizan el mismo componente/estructura o, si siguen duplicados, aplican exactamente las mismas reglas visuales.
12. Ejecutar `npm run test:coverage` en `apps/frontend` para validar las pruebas nuevas y comprobar que el codigo nuevo o modificado supera el 70% de cobertura.
13. Ejecutar `npm run build` en `apps/frontend` para validar TypeScript y build de Vite.
14. Validar manualmente en Docker Compose al menos dos escenarios: final con 6 jugadores o menos y final con mas de 6 jugadores, comprobando columnas y podio en victoria y derrota.

## Decisiones tomadas

- El cambio se limita al resumen final de partida en victoria y derrota; no modifica el calculo de puntuacion ni el backend.
- El umbral para pasar a dos columnas sera el mismo patron solicitado para estrella: mas de 6 jugadores.
- El podio se basa en el orden ya recibido en `finalResults`, que actualmente representa el ranking final calculado por backend.
- La primera posicion debe tener tratamiento oro y corona; segunda y tercera posicion deben tener tratamientos plata y bronce.
- La implementacion debe seguir la arquitectura monolitica actual del frontend: cambios pequeños en `apps/frontend/src/App.tsx`, estilos en `apps/frontend/src/styles.css` y helpers testeables si se extrae logica pura.
- No se introducen nuevas dependencias ni cambios de navegacion.
