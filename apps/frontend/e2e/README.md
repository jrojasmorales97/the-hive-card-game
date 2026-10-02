# Regresión de partidas

## Ejecución

Desde la raíz, con Docker (también es el comando de CI):

```sh
docker compose run --build --rm --no-deps e2e
```

Con las dependencias de ambos paquetes y contracts compilado:

```sh
npm --prefix apps/frontend exec -- playwright install chromium
npm --prefix apps/frontend run test:e2e
```

Para una prueba concreta: `npm --prefix apps/frontend run test:e2e -- --grep "countdown"`.
Informe HTML en `apps/frontend/playwright-report/index.html`; capturas y trazas de fallos en
`apps/frontend/test-results/`. Cero retries: un fallo real no se oculta con un reintento.

## Preparación rápida y aislamiento

Playwright levanta su propio backend (`3002`), Vite (`5174`) y un servidor de control
loopback (`3003`). No utiliza ni reinicia las salas de desarrollo (`3001` / `5173`).
El entrypoint `apps/backend/tooling/e2eServer.ts` es exclusivo de tests; el servidor
normal no registra rutas para leer ni escribir estados de prueba.

La fixture `match` crea una sala única por test con manos explícitas, jugadores humanos
o CPU, nivel, recursos, fase y desconectados. Valida cartas únicas 1–100, usa el setup
de dominio y cancela timers anteriores antes de guardar. Borra su sala al terminar.
Se entra por la identidad persistida habitual y todas las acciones posteriores usan
la UI/Socket.IO reales, el repositorio real y el scheduler real. Nunca se mockean snapshots.
Los tiempos del backend se escalan a 0.2; las animaciones del frontend se mantienen.
El test de resync adelanta exclusivamente el reloj del navegador para cruzar el polling.

Las pruebas de permisos/comandos sin UI añaden un cliente Socket.IO real junto al navegador.
La partida completa CPUON7 usa acceso y reparto normales, sin seed ni cambios de estado.

## Matriz

| Familia | Casos |
| --- | --- |
| Acceso/lobby | Crear, unirse, sala inexistente, host y mínimo de jugadores, salida/host migration, kick, impedir ingreso tardío |
| Ready | Focus, paused, ready/unready, quorum, mano vacía, bloqueo countdown |
| Cartas | Mínimo propio, carta inexistente/ajena/no mínima, payload inválido, CPU antes/después del humano, privacidad |
| Pausa | Solicitar, bloquear carta, reanudar, CPU auto-ready, controles móviles |
| Error | Una vida por error, todos los descartes menores, pausa, mano humana agotada/CPU continúa, cierre de nivel, derrota |
| Estrella | Proponer, aceptar, rechazar, cancelar; voto de mano vacía; desconectados; carta cancela propuesta; sin recursos |
| Settlement | Continuar ronda o cerrarla, timeout sin ack, ack tardío/duplicado, reload, salida, último voto desconectado, CPU-only restante |
| Progresión | Flip/cierre, siguiente reparto, desbloqueo ready, recompensa vida/estrella y sus topes, todos los niveles CPUON7 |
| Finales | Victoria, derrota, ranking, retry host, rechazo retry no autorizado |
| Sesión | Resync sin mutación, reload/mano preservada, reload durante countdown/error/estrella/lock de siguiente nivel |
| Auxiliares | Log abrir/cerrar, cancelar/confirmar salida, rutas de control ausentes en servidor del juego |

Modo ciego no se incluye: sigue siendo una funcionalidad pendiente del producto.
