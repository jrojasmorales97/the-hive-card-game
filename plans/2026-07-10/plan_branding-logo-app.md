## Solicitud original

"Fijate en el archivo the-hive-logo.png quiero que lo uses como logo de la app. preguntame todo lo que necesitas saber sobre como meterle ese branding a la app y usa tu multimodalidad para generar las variantes que necesites del logo"

## Contexto confirmado

- Archivo fuente detectado: `apps/frontend/the-hive-logo.png`.
- El usuario quiere reemplazo total del logo tipografico actual por el logo del archivo.
- El usuario delega la eleccion de variantes por contexto visual.
- El usuario autoriza generar versiones derivadas con recortes, transparencia, redimensiones y fondos necesarios para que el resultado luzca profesional.
- El usuario quiere presencia de marca en todas las pantallas, usando lo habitual en juegos de este tipo.

## Criterios de aceptacion

- DADO que abro la landing CUANDO veo el encabezado principal ENTONCES aparece el logo completo derivado de `the-hive-logo.png`, reemplazando el texto actual `The Hive`.
- DADO que estoy en waiting room/lobby CUANDO veo el panel de sala ENTONCES aparece la misma familia de logo que landing, en una escala adecuada al panel.
- DADO que estoy in-game CUANDO juego ENTONCES aparece una marca sutil tipo watermark o sello de mesa que no compite con cartas, pila, controles, timers ni overlays.
- DADO que abro la app en mobile o pantallas bajas CUANDO el layout se compacta ENTONCES el logo no empuja fuera de pantalla las acciones primarias ni reduce la legibilidad de cartas o botones.
- DADO que miro la pestana del navegador CUANDO la app esta cargada ENTONCES el favicon usa una variante apropiada del logo/icono.
- DADO que se generan assets derivados CUANDO reviso el repo ENTONCES existen variantes optimizadas y nombradas claramente: logo completo, icono, watermark y favicon.
- DADO que los assets se usan en React/Vite CUANDO ejecuto typecheck/build/test relevante ENTONCES no hay errores por imports, rutas o tipos de assets.

## Variantes de logo a generar

1. `apps/frontend/src/assets/brand/logo-full.png`
   - Uso: landing y waiting room.
   - Debe ser recortado al contenido real del logo, sin area vacia excesiva.
   - Fondo transparente si el PNG fuente lo permite o si puede extraerse limpiamente.

2. `apps/frontend/src/assets/brand/logo-icon.png`
   - Uso: espacios compactos y posible fallback responsive.
   - Debe priorizar abeja/panal sin texto.
   - Fondo transparente.

3. `apps/frontend/src/assets/brand/logo-watermark.png`
   - Uso: in-game dentro del tablero/felt.
   - Debe ser una variante de bajo contraste u opacidad apta para watermark.
   - Preferencia: icono o logo simplificado, no logo completo si compite visualmente.

4. `apps/frontend/public/favicon.png` o equivalente soportado por Vite.
   - Uso: tab del navegador.
   - Debe usar icono legible en pequeno, normalmente la abeja/panal sin texto.

## Tareas tecnicas

1. Inspeccionar `apps/frontend/the-hive-logo.png` para determinar dimensiones, transparencia real, area vacia y composicion del logo.
2. Generar assets derivados con herramientas locales disponibles, preferiblemente manteniendo PNG transparentes y evitando introducir dependencias nuevas si no son necesarias.
3. Mover o copiar las variantes finales a rutas estables dentro del frontend (`src/assets/brand` para imports de Vite y `public` para favicon si aplica).
4. Crear o ajustar un componente reusable de marca en `apps/frontend/src/App.tsx`, manteniendo la arquitectura actual de single-file app.
5. Sustituir el logo tipografico actual de landing por `logo-full.png`.
6. Usar la misma version/familia del logo en waiting room, con escala contextual pero sin cambiar la composicion de marca.
7. Sustituir el watermark in-game actual basado en texto/icono por `logo-watermark.png` o por una variante visual derivada del asset.
8. Actualizar `apps/frontend/src/styles.css` para tamanos, opacidad, posicionamiento, responsive y accesibilidad visual.
9. Actualizar `apps/frontend/index.html` o la ruta correspondiente para favicon si existe.
10. Mantener branding decorativo como `aria-hidden` cuando no aporte informacion nueva; usar `alt="The Hive"` solo donde el logo funciona como identificador principal.
11. Validar que no se rompe el layout de landing, waiting room, in-game, mobile y pantallas bajas.
12. Ejecutar `npx tsc -p tsconfig.json --noEmit` en `apps/frontend` y una validacion de build/test disponible si aplica.

## Decisiones tomadas

- Reemplazo total: se elimina el logo tipografico generado por CSS como marca principal.
- Landing y waiting room deben compartir la misma version/familia de logo, solo con escala distinta.
- In-game debe usar una marca ambiental, preferiblemente icono/watermark, para no competir con la jugabilidad.
- El favicon debe derivar del icono, no del logo completo con texto, porque el texto no sera legible a tamanos pequenos.
- Se prioriza generar assets estaticos optimizados sobre aplicar filtros CSS complejos en runtime.
- No se introduciran nuevos paquetes salvo que las herramientas locales disponibles no permitan recortar/transparencia/redimensionado de forma fiable.

## Riesgos y comprobaciones

- Si el PNG fuente incluye checkerboard como pixeles reales en vez de transparencia, habra que extraer/limpiar el fondo; verificar visualmente el resultado generado.
- Si la extraccion del icono desde el logo completo no queda limpia, elegir un crop conservador que mantenga la abeja/panal completa.
- Si el watermark in-game reduce contraste o distrae, bajar opacidad/tamano antes que moverlo a topbar.
- CSS y assets no tienen cobertura unitaria directa; la validacion principal sera typecheck/build y revision visual.
