## Criterios de aceptacion

- DADO que se completa un nivel por jugadas normales CUANDO aparece el mensaje de `LEVEL COMPLETE` ENTONCES el boton `Ready` se habilita exactamente cuando desaparece el mensaje, sin espera adicional perceptible.
- DADO que se completa un nivel por jugadas normales CUANDO el backend cambia al siguiente nivel ENTONCES el estado autoritativo, el lock de interaccion y el overlay visible del frontend quedan sincronizados en la misma ventana temporal.
- DADO que una estrella descarta las ultimas cartas del nivel CUANDO se resuelve la estrella ENTONCES primero aparece y termina el mensaje de estrella activada con sus descartes.
- DADO que una estrella descarta las ultimas cartas del nivel CUANDO termina el mensaje de estrella activada ENTONCES aparece despues el mensaje de `LEVEL COMPLETE` y no antes ni al mismo tiempo.
- DADO que termina el mensaje de `LEVEL COMPLETE` tras una estrella que completo nivel CUANDO se muestra el siguiente nivel ENTONCES el boton `Ready` queda disponible sin retraso adicional.
- DADO que hay CPU en la sala CUANDO el flujo esta en estrella activada, level complete o reparto siguiente ENTONCES ninguna CPU juega hasta que backend y frontend hayan terminado la secuencia esperada.
- DADO que el cliente recibe eventos `game:star-used`, `game:level-complete` y `game:next-level-ready` en rafaga CUANDO los procesa ENTONCES los overlays se muestran en orden determinista y no se pierden.
- DADO que se recarga o resync durante una transicion CUANDO el cliente recibe el snapshot de sala ENTONCES respeta el lock autoritativo vigente y no habilita acciones antes de tiempo.
- DADO que se ejecutan pruebas y builds relevantes CUANDO termina la implementacion ENTONCES los tests pasan, la cobertura del codigo nuevo o modificado alcanza al menos 70% y no hay errores bloqueantes de build.

## Tareas tecnicas

1. Revisar el flujo backend completo de fin de ronda en `apps/backend/src/index.ts`: `playCardInRoom()`, `resolveStarIfEveryoneAccepted()`, `resolveStar()`, `scheduleLevelCompletionAfterRoundOut()`, `completeLevelOrGame()`, `setInteractionLock()` y `scheduleCpuTurn()`.
2. Revisar el flujo frontend completo en `apps/frontend/src/App.tsx`: handlers de `game:star-used`, `game:level-complete`, `game:next-level-ready`, `showEventOverlay()`, `eventOverlayEndsAtRef`, `pendingLevelCompleteRef`, calculo de `readyBlocked` y placeholders de acciones.
3. Definir una unica fuente de verdad para la duracion de overlays bloqueantes y locks relacionados, evitando duplicar magic numbers entre backend y frontend cuando sea posible mediante constantes paralelas testeadas.
4. Corregir la secuencia backend para que el nivel completado que nace desde estrella no avance ni emita estado de siguiente nivel antes de que termine el periodo de estrella.
5. Corregir la secuencia backend de `level-complete` para que el lock que impide `ready` termine al mismo tiempo que el overlay visible, no despues.
6. Revisar si `dealLevel()` debe ejecutarse antes, durante o despues del overlay de `level-complete`; escoger la opcion que evite que el jugador vea `Ready` bloqueado tras desaparecer el mensaje.
7. Corregir la logica frontend para que `game:level-complete` no se pierda cuando `pileHistory` queda vacio por estrella y para que se muestre aunque no exista pila manual que limpiar.
8. Reemplazar referencias fragiles basadas solo en `phase`/`pileHistory.length` por una cola o estado explicito minimo de overlays pendientes si hace falta para ordenar `star-used` -> `level-complete` -> `next-level-ready`.
9. Asegurar que `eventOverlayEndsAtRef` o mecanismo equivalente se actualiza y limpia de forma fiable en todos los caminos: timeout normal, game over, victory, leave room, resync y nuevo overlay.
10. Asegurar que el frontend no habilita `Ready`, `Star`, `Pause` ni jugar carta mientras el backend tenga lock activo, pero que tampoco mantenga bloqueo visual si el lock ya expiro y el overlay correspondiente desaparecio.
11. Agregar pruebas unitarias frontend en helpers existentes o nuevos para cubrir la cola/secuenciacion de overlays: estrella antes de level complete, level complete sin pila, y calculo de retraso sin espera extra tras desaparecer el overlay.
12. Agregar pruebas unitarias backend en helpers existentes o nuevos para cubrir duraciones y orden de locks: estrella que completa nivel, level complete normal y liberacion de ready al final exacto del lock esperado.
13. Ejecutar `npm run test:coverage` en `apps/frontend` y `apps/backend`, verificando al menos 70% de cobertura sobre codigo nuevo o modificado.
14. Ejecutar `npm run build` en `apps/frontend` y `apps/backend` para validar TypeScript/build.
15. Si se modifican archivos de codigo, ejecutar `graphify hook-rebuild` al final para mantener actualizado el grafo del proyecto.

## Decisiones tomadas

- El problema debe resolverse como sincronizacion de maquina de estados backend/frontend, no como ajuste cosmetico de tiempos aislados.
- La experiencia esperada es estrictamente secuencial: estrella activada, despues level complete, despues siguiente nivel/ready.
- El backend sigue siendo la autoridad para impedir acciones y CPU; el frontend solo refleja locks y ordena overlays para que el jugador entienda la secuencia.
- El mensaje `LEVEL COMPLETE` no debe desaparecer antes de que el jugador pueda actuar ni debe dejar un tiempo muerto adicional tras desaparecer.
- El caso estrella que completa nivel es critico y debe tener cobertura explicita; no basta con cubrir el fin de nivel por jugadas normales.
- No se cambian reglas de negocio: la estrella sigue descartando cartas, el nivel se completa al quedarse sin cartas y las recompensas/progresion se mantienen.
- Se respetan las convenciones actuales: backend monolitico en `apps/backend/src/index.ts`, frontend monolitico en `apps/frontend/src/App.tsx`, helpers puros testeables cuando sea viable y tests con `node:test` + `tsx`.
