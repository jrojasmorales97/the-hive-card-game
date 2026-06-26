## Criterios de aceptacion

- DADO QUE una partida termina en victoria o derrota, CUANDO aparece la pantalla final, ENTONCES debe mostrarse un resumen visible para toda la sala con la puntuacion de sincronizacion de cada jugador en una escala de 1 a 100.
- DADO QUE la partida ha terminado, CUANDO se renderiza el resumen final, ENTONCES deben aparecer tanto jugadores humanos como CPU sin distincion en el calculo ni en la presentacion de resultados.
- DADO QUE existe una secuencia global real de cartas jugadas durante la partida, CUANDO se calcula la puntuacion de un jugador, ENTONCES esta debe basarse en su desfase respecto al momento esperable de sus jugadas siguiendo la velocidad media del resto de jugadores.
- DADO QUE un jugador mantiene un timing muy cercano a la media esperable, CUANDO se genera su feedback final, ENTONCES el mensaje debe indicar que va bien o que esta bien sincronizado, evitando sugerir una sobrecorreccion innecesaria.
- DADO QUE un jugador se desvía claramente por jugar demasiado pronto o demasiado tarde, CUANDO se muestra el resumen final, ENTONCES debe aparecer un feedback visible que indique si va rapido o lento y sugiera ajustar su timing.
- DADO QUE durante la partida un jugador provoca errores, CUANDO se calcula su puntuacion final, ENTONCES esos errores deben penalizar su nota de sincronizacion.
- DADO QUE el resumen final es compartido por toda la sala, CUANDO se presentan los resultados, ENTONCES el tono debe ser visible y divertido, incluyendo mensajes que se metan un poco con quienes lo han hecho peor sin romper la comprension del feedback.
- DADO QUE una partida aun no ha terminado, CUANDO se completa un nivel intermedio, ENTONCES no debe mostrarse aun el ranking final ni el resumen de puntuacion.
- DADO QUE la partida termina tras reconexiones, pausas, estrellas o bloqueos temporales ya soportados, CUANDO se calcula la puntuacion final, ENTONCES el resultado debe basarse en el historial real de jugadas de la partida y no romper esos flujos existentes.

## Tareas tecnicas

1. Sustituir el plan previo de transiciones por este alcance nuevo en `plan.md`, dejando fijado que la funcionalidad pedida afecta solo al final de partida y no a cierres de nivel intermedios.

2. Extender el modelo de datos del backend en `apps/backend/src/index.ts` para registrar la informacion temporal necesaria de cada jugada real de la partida.
   Esto implica guardar timestamps y contexto suficiente por carta jugada para poder reconstruir el ritmo global al final.

3. Definir en backend una estructura explicita de metricas finales por jugador.
   Debe incluir como minimo: identificador de jugador, nombre, puntuacion 1-100, clasificacion de timing, explicacion corta del feedback y penalizacion por errores.

4. Diseñar e implementar la formula de puntuacion en backend siguiendo las decisiones cerradas:
   usar el desfase respecto al momento esperable de cada jugada,
   calcular ese momento esperable a partir de la velocidad media del resto de jugadores,
   penalizar los errores,
   y amortiguar desviaciones pequenas para que no generen feedback de sobrecorreccion.

5. Definir umbrales de interpretacion del timing para convertir la metrica numerica en categorias comprensibles.
   Como minimo deben existir estados equivalentes a: bien sincronizado, algo rapido, muy rapido, algo lento y muy lento.

6. Definir tambien la capa de copy final en backend o frontend para el tono del feedback.
   Debe ser visible, divertido y compartido por toda la sala, pero manteniendo mensajes claros para que cada jugador entienda si debe acelerar, frenar o mantener su timing.

7. Integrar el calculo de resultados en los puntos de cierre de partida ya existentes en backend:
   victoria (`game.phase === 'victory'`) y derrota (`game.phase === 'game-over'`).
   El backend debe dejar el resumen final disponible en el snapshot de sala o emitirlo por contrato de evento sin introducir inconsistencias con el flujo actual.

8. Ajustar `serializeRoom()` y el contrato cliente-servidor para exponer el resumen final al frontend de forma estable y renderizable tras terminar la partida.

9. Adaptar el frontend en `apps/frontend/src/App.tsx` para mostrar el ranking final en los overlays de victoria y derrota.
   Debe incluir puntuacion, orden relativo, nombre del jugador y feedback textual de velocidad para toda la sala.

10. Ajustar el diseño visual del resultado final para que el ranking sea legible tanto en desktop como en mobile dentro del overlay ya existente, sin introducir navegación nueva ni romper la UX actual de retry / leave room.

11. Revisar como impactan en la metrica los flujos especiales ya soportados:
    cartas autojugadas por estrella,
    pausas,
    reconexiones,
    CPUs,
    y cierres por derrota antes de completar todos los niveles.
    Dejar explícito en implementación qué eventos cuentan para el scoring y cuáles deben excluirse del cálculo de velocidad esperable si distorsionan la señal.

12. Añadir pruebas unitarias para la formula de puntuacion y los helpers nuevos que la soporten.
    Deben cubrir al menos: jugador alineado con la media, jugador claramente rapido, jugador claramente lento, desviacion ligera que sigue dando feedback positivo y penalizacion por error.

13. Verificar cobertura sobre el codigo nuevo o modificado usando la infraestructura de cobertura ya incorporada en el repo.
    La cobertura del codigo añadido para scoring y clasificacion debe quedar al menos por encima del 70% exigido.

14. Validar manualmente el flujo final con Docker Compose en partidas completas de victoria y derrota.
    La validacion debe comprobar ranking compartido, presencia de CPUs en el resumen, penalizacion de errores y mensajes de feedback coherentes con el ritmo observado.

15. Si el contrato final de sala o el overlay de resultado cambian de forma relevante, actualizar la documentacion minima del proyecto para reflejar que el final de partida ahora incluye un resumen de sincronizacion por jugador.

## Decisiones tomadas

- La funcionalidad se limita al final de la partida completa; no se mostrara puntuacion al final de cada nivel.
- El ranking debe incluir tanto jugadores humanos como CPU sin distincion funcional ni visual en el calculo base.
- La metrica principal no sera el tiempo medio bruto entre jugadas propias, sino el desfase respecto al momento esperable de cada carta dentro de la secuencia global.
- El momento esperable de un jugador debe derivarse de la velocidad media del resto de jugadores, no de su propio historial aislado.
- La formula debe penalizar los errores cometidos durante la partida.
- La presentacion final debe incluir una puntuacion numérica de 1 a 100 y un feedback textual util para ajustar el timing en partidas futuras.
- El feedback debe ser visible para toda la sala y con tono divertido, incluyendo bromas ligeras sobre quienes lo hicieron peor.
- Las desviaciones pequenas respecto a la media deben seguir clasificandose como buen timing para evitar sobrecorregir comportamientos que ya funcionaban bien.
- No existe `business.md` en el repositorio.
- No existe `architecture.md` en el repositorio.
- En ausencia de esos documentos, el plan se apoya en `AGENTS.md`, `README.md` y la arquitectura real del proyecto: backend monolitico en `apps/backend/src/index.ts` y frontend monolitico en `apps/frontend/src/App.tsx`.
- Gap tecnico identificado y ya cerrado a nivel de plan: el backend actual no conserva timestamps por jugada en `pileHistory`, por lo que sera necesario ampliar el registro temporal de la partida para soportar este scoring.
- Gap funcional resuelto con tus respuestas: el resumen final es global, compartido y solo aparece al terminar la partida, no durante el progreso de niveles.
