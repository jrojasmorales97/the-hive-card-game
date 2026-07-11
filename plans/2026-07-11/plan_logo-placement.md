## Criterios de aceptacion

- DADO que la app se abre en un navegador CUANDO se observa la pestana del navegador ENTONCES el icono visible corresponde al archivo `the-hive-logo-sm.png`.
- DADO que el jugador esta en la pantalla de acceso inicial CUANDO se renderiza la marca principal ENTONCES el logo se mantiene centrado y visualmente coherente con el layout existente.
- DADO que el jugador esta en la pantalla de espera de sala CUANDO se muestra el panel de espera ENTONCES el logo aparece centrado encima del contenedor del panel, como elemento externo superior, y no queda dentro de su borde, fondo ni padding.
- DADO que el jugador esta en la pantalla de espera de sala CUANDO se observa el contenido del panel ENTONCES los controles, el codigo de sala, el texto de espera, la grilla de jugadores y el boton de inicio mantienen separacion suficiente y no se superponen con el logo.
- DADO que el jugador esta en la pantalla de juego CUANDO se observa la pila central ENTONCES el logo aparece centrado arriba y abajo de la pila central, sin sustituir ni ocultar el area clicable de la pila.
- DADO que el jugador esta en la pantalla de juego CUANDO hay cartas en la pila central ENTONCES los logos superior e inferior permanecen legibles, alineados con la pila y no tapan cartas, asientos de jugadores, recursos ni acciones.
- DADO que la app se valida en escritorio y movil CUANDO se capturan todas las pantallas principales con Playwright ENTONCES las capturas evidencian logos centrados, margenes consistentes, ausencia de recortes y ausencia de solapamientos visuales.

## Tareas tecnicas

### Codigo

- [ ] ID: C-01
  - Objetivo: Mantener el logo principal de la app usando el asset grande existente.
  - Cambios: Revisar `apps/frontend/src/App.tsx` para conservar `the-hive-logo.png` como fuente de las marcas visuales dentro de la app y evitar reutilizar el asset pequeno como logo de contenido.
  - Dependencias: Ninguna.
  - Validacion: Confirmar en build que el asset grande sigue siendo incluido y que no hay imports rotos en `App.tsx`.

- [ ] ID: C-02
  - Objetivo: Colocar el logo de la pantalla de espera encima del contenedor visual del panel, no dentro.
  - Cambios: En el bloque `room && isLobbyRoom` de `App.tsx`, mover `MainBrandMark` para que sea hermano anterior inmediato de `section.panel.waiting-room-panel` dentro de `room-waiting-stack`, eliminando su render dentro de `waiting-room-shell` y evitando cualquier wrapper descendiente del panel.
  - Dependencias: C-01.
  - Validacion: Verificar con el inspector/Playwright que el logo no es descendiente de `.waiting-room-panel`, que se renderiza antes del panel y que aparece visualmente encima del contenedor de espera.

- [ ] ID: C-03
  - Objetivo: Ajustar estilos de la marca en la pantalla de espera tras moverla fuera del panel.
  - Cambios: Actualizar `apps/frontend/src/styles.css` para reemplazar o complementar la regla actual `.waiting-room-panel .brand-mark-main` por una clase o selector propio de logo de espera, centrado encima del panel, con ancho responsive y margen vertical coherente entre logo y contenedor.
  - Dependencias: C-02.
  - Validacion: Comprobar en capturas de escritorio y movil que el logo queda centrado sobre el panel, sin tocar el borde superior del panel ni empujar la grilla fuera de pantalla.

- [ ] ID: C-04
  - Objetivo: Mostrar el logo arriba y abajo de la pila central en la pantalla de juego.
  - Cambios: Reestructurar el marcado alrededor de `.center-pile` en `App.tsx` para agregar dos marcas decorativas con `the-hive-logo.png`, una sobre la pila y otra debajo, manteniendo el `role="button"`, `aria-label`, `ref` y handlers actuales en la pila central.
  - Dependencias: C-01.
  - Validacion: Confirmar que hacer click o pulsar Enter/Espacio sobre la pila central sigue abriendo/cerrando el log y que los logos no reciben foco ni interceptan eventos.

- [ ] ID: C-05
  - Objetivo: Alinear los logos de juego con la pila central sin romper la composicion de la mesa.
  - Cambios: Ajustar `styles.css` para posicionar los dos logos respecto al centro de `.felt-stage`, usando dimensiones responsive compatibles con las variables existentes de `.game-layout` y con los breakpoints ya definidos.
  - Dependencias: C-04.
  - Validacion: Revisar en capturas que los logos superior e inferior estan centrados respecto a `.center-pile` y no se superponen con cartas, countdown, jugadores, recursos, mano ni acciones.

- [ ] ID: C-06
  - Objetivo: Ajustar margenes y paddings detectados como incorrectos durante la validacion visual.
  - Cambios: Retocar unicamente reglas de layout/espaciado afectadas por la nueva ubicacion de logos en `styles.css`, priorizando `.room-waiting-stack`, `.waiting-room-panel`, `.waiting-room-shell`, `.felt-stage`, `.center-pile` y breakpoints responsive relacionados.
  - Dependencias: C-03, C-05.
  - Validacion: Comparar capturas antes/despues dentro de la validacion Playwright y confirmar que no hay overflow, recortes ni espacios visualmente desbalanceados.

### Configuracion

- [ ] ID: CFG-01
  - Objetivo: Usar el asset pequeno como icono de pestana del navegador.
  - Cambios: Actualizar `apps/frontend/index.html` para que el `link rel="icon"` apunte a `./the-hive-logo-sm.png` y no al logo grande.
  - Dependencias: Existencia de `apps/frontend/the-hive-logo-sm.png`.
  - Validacion: Abrir la app en navegador con cache limpia o recarga dura y verificar mediante Playwright/DOM que el `href` del favicon resuelve al asset pequeno.

### Tests

- [ ] ID: T-01
  - Objetivo: Verificar que el frontend compila con las referencias nuevas de assets y layout.
  - Cambios: Ejecutar `docker compose exec frontend npm run build` usando el flujo Docker Compose soportado por el proyecto.
  - Dependencias: C-01, C-02, C-03, C-04, C-05, CFG-01.
  - Validacion: El comando termina con codigo 0 y sin errores TypeScript/Vite por imports, JSX o CSS referenciado desde la app.

- [ ] ID: T-02
  - Objetivo: Validar visualmente todas las pantallas principales con Playwright en escritorio.
  - Cambios: Con el stack levantado por Docker Compose, usar Playwright en `http://localhost:5173` para capturar al menos pantalla de acceso, pantalla de espera y pantalla de juego; usar una sala normal o el modo dev CPU si acelera llegar a juego sin cambiar reglas de producto.
  - Dependencias: T-01.
  - Validacion: Las capturas muestran favicon correcto, logo de espera fuera del panel y logos superior/inferior centrados alrededor de la pila central, sin solapamientos visibles.

- [ ] ID: T-03
  - Objetivo: Validar visualmente las mismas pantallas principales con Playwright en movil.
  - Cambios: Repetir la navegacion y capturas de T-02 con viewport movil representativo, por ejemplo 390x844, incluyendo acceso, espera y juego.
  - Dependencias: T-02.
  - Validacion: Las capturas moviles muestran que los logos no quedan cortados, no desplazan controles criticos fuera del viewport y mantienen centrado respecto a su contenedor o pila.

- [ ] ID: T-04
  - Objetivo: Confirmar que los cambios visuales no rompen interacciones basicas.
  - Cambios: Durante la sesion Playwright, crear o unirse a sala, iniciar partida, abrir/cerrar el log desde la pila central y comprobar que los botones principales siguen siendo operables.
  - Dependencias: T-02, T-03.
  - Validacion: Las acciones completan sin errores visibles en UI ni errores relevantes en consola del navegador.

## Decisiones tomadas

- Se usara `apps/frontend/the-hive-logo-sm.png` exclusivamente como favicon/icono de pestana del navegador.
- Se mantendra `apps/frontend/the-hive-logo.png` como logo visual dentro de la app para conservar mayor resolucion en pantalla.
- En la pantalla de espera, el logo no formara parte del `section.panel.waiting-room-panel`; debe quedar encima del contenedor como elemento visual externo.
- El cambio se limitara al frontend: no se modificaran reglas de juego, backend, contratos Socket.IO ni estado de salas.
- Se respetara la arquitectura actual de frontend monolitico: cambios en `App.tsx`, `styles.css` e `index.html`, sin introducir router, libreria de estado ni estructura nueva de componentes.
- La validacion con Playwright sera manual/asistida con capturas, porque el repositorio no tiene suite E2E existente; no se agregara una infraestructura E2E permanente salvo que se solicite aparte.
- Para “todas las pantallas” se cubriran las pantallas principales alcanzables del flujo actual de una sola pagina: acceso inicial, espera de sala y juego; overlays transitorios solo se revisaran si aparecen durante la navegacion de validacion.
- Los ajustes de margenes y paddings quedan acotados a problemas observados por la nueva ubicacion de logos; no se hara un rediseño visual general fuera de ese alcance.
