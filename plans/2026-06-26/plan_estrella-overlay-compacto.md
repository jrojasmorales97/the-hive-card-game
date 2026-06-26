## Criterios de aceptacion

- DADO que una estrella activada descarta cartas de hasta 6 jugadores CUANDO se muestra el overlay de estrella ENTONCES todos los descartes se ven completos dentro del overlay sin scroll vertical.
- DADO que una estrella activada descarta cartas de mas de 6 jugadores CUANDO el overlay usa dos columnas ENTONCES todos los descartes se ven correctamente distribuidos, sin solapamientos y sin cortar informacion esencial.
- DADO que se muestran descartes en el overlay de estrella CUANDO se renderiza cada descarte ENTONCES la fila es mas compacta en altura que la version actual y la carta usa el mismo tamano visual que las cartas secundarias de la mano del jugador.
- DADO que el overlay de estrella activada aparece tras resolver el consenso CUANDO se compara con la duracion actual ENTONCES permanece visible durante mas tiempo que ahora.
- DADO que la estrella esta resolviendose o su bloqueo autoritativo esta activo CUANDO un jugador humano intenta jugar una carta ENTONCES el backend rechaza la jugada hasta que termine el bloqueo.
- DADO que la estrella esta resolviendose o su bloqueo autoritativo esta activo CUANDO hay jugadores CPU en la sala ENTONCES ninguna CPU juega cartas hasta que termine el bloqueo.
- DADO que se muestran mensajes, errores, logs o copies visibles de la experiencia actual CUANDO el usuario usa la app ENTONCES el texto visible sale en ingles por ahora y no aparecen copies en espanol.
- DADO que se ejecutan las pruebas y builds relevantes CUANDO termina la implementacion ENTONCES los tests pasan, la cobertura del codigo nuevo o modificado alcanza al menos 70% y no hay errores bloqueantes de build.

## Tareas tecnicas

1. Revisar la UI actual de estrella en `apps/frontend/src/App.tsx`, `apps/frontend/src/styles.css`, `apps/frontend/src/starUi.ts` y `apps/frontend/src/messageTiming.ts` para ubicar layout, tamano de carta, duracion del overlay y helpers testeables existentes.
2. Ajustar los estilos del listado de descartes de estrella para reducir la altura de filas, padding y gaps, reutilizando dimensiones equivalentes a las cartas secundarias de la mano del jugador.
3. Revisar la regla de layout de una o dos columnas para asegurar que hasta 6 descartes se muestran sin scroll y que mas de 6 descartes caben bien en dos columnas con hasta 8 jugadores.
4. Extender o actualizar helpers puros en `starUi.ts` si hace falta para decidir layout compacto de forma testeable, manteniendo `App.tsx` con cambios minimos.
5. Aumentar la duracion del overlay de estrella en `messageTiming.ts` o en el punto centralizado equivalente, sin alterar duraciones de otros mensajes salvo que sea necesario por consistencia tecnica.
6. Revisar la resolucion backend de estrella en `apps/backend/src/index.ts` y el helper de locks en `apps/backend/src/gameTiming.ts` para introducir o reutilizar un bloqueo autoritativo durante la resolucion/visualizacion de estrella.
7. Asegurar que `game:play-card`, programacion de turnos CPU y cualquier camino de juego automatico respeten el bloqueo autoritativo de estrella antes de jugar cartas.
8. Auditar copies visibles en frontend y mensajes/errores/logs emitidos desde backend para reemplazar textos en espanol por ingles, manteniendo el alcance en la experiencia actual del juego.
9. Actualizar pruebas frontend para cubrir layout compacto/dos columnas de estrella y duracion nueva del overlay de estrella.
10. Actualizar pruebas backend para cubrir que el bloqueo de estrella impide jugadas humanas y turnos CPU mientras esta activo, o aislar la logica nueva en helpers testeables si no hay test de integracion Socket.IO disponible.
11. Ejecutar `npm run test:coverage` en `apps/frontend` y `apps/backend`, verificando al menos 70% de cobertura sobre codigo nuevo o modificado.
12. Ejecutar `npm run build` en `apps/frontend` y `apps/backend` para validar TypeScript/build.
13. Si se modifican archivos de codigo, ejecutar `graphify hook-rebuild` al final para mantener actualizado el grafo del proyecto.

## Decisiones tomadas

- El cambio visual se limita al overlay de estrella activada y a sus descartes; no cambia la regla de negocio de que la estrella descarta la carta mas baja de cada jugador sin agregarla a la pila central.
- La duracion de estrella debe aumentar respecto a la duracion actual centralizada, pero el valor exacto queda como decision de implementacion siempre que sea verificable en tests.
- El bloqueo para impedir jugadas durante estrella debe ser autoritativo en backend, no solo visual en frontend, porque incluye jugadores CPU y clientes potencialmente desincronizados.
- La normalizacion de idioma aplica a copies visibles actuales de la app y mensajes emitidos por backend dentro del flujo existente; no implica introducir i18n ni soporte multiidioma.
- Se respetan las convenciones actuales: backend monolitico en `apps/backend/src/index.ts`, frontend monolitico en `apps/frontend/src/App.tsx`, helpers puros testeables cuando sea posible y tests con `node:test` + `tsx`.
- No se requieren migraciones ni persistencia nueva porque el estado de salas sigue siendo en memoria.
