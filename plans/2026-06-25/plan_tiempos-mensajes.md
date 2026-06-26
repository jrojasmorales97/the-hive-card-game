## Criterios de aceptacion

- DADO que aparece un mensaje de error por jugar una carta fuera de orden, CUANDO se muestra el overlay de error, ENTONCES debe permanecer visible el tiempo suficiente para leer la carta jugada, las cartas bloqueantes y la penalizacion de vida.
- DADO que se activa una estrella, CUANDO se muestra el mensaje visual de estrella activada con descartes por jugador, ENTONCES debe permanecer visible mas tiempo que ahora para que el jugador entienda que cartas han salido y por que desaparecen de la mano.
- DADO que se solicita una pausa, CUANDO aparece el mensaje de pausa, ENTONCES debe permanecer visible el tiempo necesario para entender que todos deben volver a prepararse.
- DADO que se completa un nivel, CUANDO aparece el mensaje de nivel superado y recompensa, ENTONCES debe permanecer visible el tiempo suficiente para leer nivel, recompensa y cambio de recursos.
- DADO que se reinicia una partida, CUANDO aparece el mensaje de reinicio, ENTONCES debe permanecer visible lo suficiente para confirmar que la sala continua y la partida vuelve a empezar.
- DADO que aparece un mensaje puramente informativo de texto corto, CUANDO se renderiza, ENTONCES debe usar una duracion menor que los mensajes con listas, descartes o consecuencias de juego.
- DADO que cualquier overlay muestra una barra de progreso, CUANDO se cambia su duracion, ENTONCES la animacion de la barra debe seguir sincronizada con la duracion real del mensaje.
- DADO que los mensajes se muestran durante una partida en curso, CUANDO se amplian sus duraciones, ENTONCES no deben bloquear ni desincronizar estados autoritativos del backend mas alla de los bloqueos de interaccion ya existentes.

## Tareas tecnicas

1. Revisar en `apps/frontend/src/App.tsx` todas las llamadas a `showEventOverlay()` y los `setTimeout()` de mensajes informativos para catalogar duraciones actuales.
2. Definir constantes semanticas de duracion en frontend para evitar numeros magicos en llamadas a `showEventOverlay()`.
3. Aplicar esta propuesta de duraciones:
   - Error de carta / penalizacion: 5200 ms.
   - Estrella activada con descartes: 6200 ms.
   - Pausa solicitada: 4200 ms.
   - Nivel completado con posible recompensa: 4400 ms.
   - Partida reiniciada: 3600 ms.
   - Mensajes informativos cortos tipo `info`: 3000 ms.
   - Mensajes de restauracion/reconexion que no son overlay modal: mantener 3000 ms salvo que se conviertan en overlay.
4. Cambiar especificamente el overlay de `game:star-used`, actualmente demasiado corto, para usar la duracion propuesta de 6200 ms.
5. Mantener sincronizada la barra de progreso del overlay usando `eventOverlay.durationMs` como ya ocurre en `apps/frontend/src/App.tsx`.
6. Revisar si existe alguna duracion equivalente en backend para locks de interaccion, como error o resolucion de estrella, y no modificarla salvo que sea estrictamente necesario para que el frontend no oculte informacion antes de tiempo.
7. Añadir o ajustar un helper puro si se extrae un mapa de duraciones por tipo de mensaje, por ejemplo en un archivo frontend testeable.
8. Añadir pruebas unitarias para validar que cada tipo de mensaje obtiene la duracion esperada, especialmente estrella activada, error, pausa y nivel completado.
9. Ejecutar `npm run test:coverage` en `apps/frontend` para comprobar que el helper nuevo o modificado supera el 70% de cobertura.
10. Ejecutar `npm run build` en `apps/frontend` para validar TypeScript y build de Vite.
11. Validar manualmente con Docker Compose los casos principales: error, estrella activada, pausa y nivel completado, comprobando que el jugador puede leer y entender cada mensaje sin perder contexto.

## Decisiones tomadas

- La estrella activada debe durar claramente mas que ahora porque contiene varios descartes, nombres de jugadores y cambios visibles en la mano.
- La duracion propuesta para estrella activada es 6200 ms.
- La duracion propuesta para error es 5200 ms porque comunica causa, cartas implicadas y perdida de vida.
- La duracion propuesta para pausa es 4200 ms porque comunica una accion cooperativa que requiere respuesta del grupo.
- La duracion propuesta para nivel completado es 4400 ms porque puede incluir recompensa y cambio de recursos.
- La duracion propuesta para reinicio se mantiene en 3600 ms porque es confirmacion breve y ya no requiere leer listas.
- Los mensajes informativos cortos se mantienen en 3000 ms para no ralentizar el ritmo de juego.
- El cambio debe limitarse al frontend y a helpers/pruebas asociados; no se modifica la logica de juego ni el calculo de scoring.
- No se introducen nuevas dependencias ni cambios de navegacion.
