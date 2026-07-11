## Criterios de aceptacion

- DADO una sala en fase de lobby CUANDO se muestra la pantalla de espera ENTONCES el codigo de sala aparece una sola vez como control copiable y no se duplica entre topbar y panel principal.
- DADO una sala en fase de lobby CUANDO se visualiza en una resolucion pequena ENTONCES el contenido principal cabe de forma usable sin que el codigo, los iconos superiores o el texto empujen fuera de pantalla las tarjetas de jugadores.
- DADO una sala en fase de lobby CUANDO se visualiza en desktop, tablet o mobile ENTONCES el layout mantiene proporciones compactas mediante reglas responsive equivalentes al resto de pantallas del juego.
- DADO una sala en fase de lobby CUANDO se renderiza el encabezado del panel ENTONCES se eliminan textos e iconos decorativos innecesarios y queda solo la informacion minima para entender que se esta esperando en sala.
- DADO una sala en fase de lobby CUANDO se renderizan los jugadores ENTONCES cada `player-waiting-card` se presenta como un hexagono o celda hexagonal, no como tarjeta rectangular grande.
- DADO varias personas dentro del lobby CUANDO se listan sus tarjetas ENTONCES los hexagonos se disponen visualmente como un panal, con offsets o filas alternas que refuercen la tematica de colmena.
- DADO una sala en fase de lobby CUANDO el usuario actual es host ENTONCES los controles de expulsion siguen estando disponibles sobre los jugadores expulsables sin romper la forma hexagonal ni ocupar demasiado espacio.
- DADO una sala en fase de lobby CUANDO el usuario actual no es host ENTONCES no se muestran controles de expulsion y la pantalla sigue siendo compacta.
- DADO una sala en fase de lobby CUANDO hay slots vacios ENTONCES estos no ocupan mas espacio del necesario y mantienen la lectura de panal sin generar scroll excesivo.
- DADO una sala en fase de lobby CUANDO el host puede empezar la partida ENTONCES el boton de empezar permanece visible y accesible en resoluciones pequenas.

## Tareas tecnicas

1. Revisar la rama de render de lobby en `apps/frontend/src/App.tsx` y las reglas actuales de `apps/frontend/src/styles.css` para identificar elementos duplicados, tamanos fijos grandes y texto/iconografia prescindible.
2. Ajustar el topbar para que, mientras `room.status === 'lobby'`, no muestre el `room-pill` copiable si el panel principal ya muestra el codigo de sala; conservar salida de sala y estados necesarios.
3. Compactar el encabezado del lobby reduciendo jerarquia visual: mantener codigo copiable, una etiqueta/mensaje breve de espera y eliminar o reducir iconos decorativos grandes que no aportan accion.
4. Reducir copy del lobby a una frase corta que deje claro que se esta dentro de sala esperando al host, evitando parrafos largos en pantallas pequenas.
5. Redisenar la estructura visual de `waiting-player-card` para que sea hexagonal o celda de panal, usando CSS/clip-path/bordes neon sin introducir librerias nuevas.
6. Cambiar la grilla de jugadores a disposicion tipo panal con filas alternas u offsets controlados por CSS, garantizando legibilidad para 1 a 8 jugadores.
7. Redefinir los slots vacios para que sean hexagonos discretos o se oculten/reduzcan segun breakpoint, evitando que ocupen espacio excesivo en mobile.
8. Ajustar los controles de expulsion del host para que se integren en el borde del hexagono y mantengan area tactil suficiente sin deformar el panal.
9. Ajustar el boton inferior de empezar para que tenga tamano compacto, permanezca visible y no fuerce scroll innecesario en resoluciones pequenas.
10. Crear o actualizar breakpoints responsive en `styles.css` para desktop, tablet, mobile y pantallas bajas, priorizando que codigo, mensaje, panal y CTA sean visibles de forma equilibrada.
11. Si se modifica logica pura de lobby en `apps/frontend/src/lobbyUi.ts` o helper equivalente, actualizar sus tests unitarios; si el cambio es solo CSS/markup, mantener los tests existentes sin anadir pruebas fragiles de layout.
12. Ejecutar `npm run test:coverage` en `apps/frontend` y `npx tsc -p tsconfig.json --noEmit` para validar tipos y cobertura de helpers afectados.
13. Verificar manualmente con el flujo Docker Compose en al menos: mobile estrecho similar a la captura, tablet y desktop, comprobando ausencia de codigo duplicado, panal compacto y boton de empezar accesible.

## Decisiones tomadas

- El ajuste se limita al lobby de espera ya existente; no cambia reglas backend de union, expulsion, inicio ni reconexion.
- El codigo de sala tendra una unica representacion visible durante lobby: preferentemente dentro del panel principal, no duplicado en topbar.
- Se prioriza compacidad y responsividad sobre fidelidad exacta a la maqueta inicial, porque la captura muestra problemas de overflow en resoluciones pequenas.
- Las tarjetas de espera pasan a leerse como celdas hexagonales de panal; la informacion por jugador se reducira a nombre, host/CPU si aplica y estado minimo.
- No se introduciran nuevas dependencias visuales ni router/componentizacion nueva; se respetara el patron actual de `App.tsx` y `styles.css` con helpers puros solo si aportan testabilidad.
- Los cambios de CSS deben mantener la estetica actual de fondo hexagonal, transparencia y bordes violetas/neon.
