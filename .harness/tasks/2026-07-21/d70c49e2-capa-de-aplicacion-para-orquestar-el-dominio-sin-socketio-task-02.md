---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: task
created_at: 2026-07-21T22:08:01Z
created_by_command: /sdd:task
source_prompt: |-
  Quiero introducir una capa de aplicacion que orqueste el dominio sin depender de Socket.IO.

  Alcance:
  - Crear casos de uso para sala, reconexion, inicio, ready, jugar, pausa, estrella, retry y desconexion.
  - Definir dependencias para repositorio, eventos, reloj, random y scheduler.
  - Devolver resultados tipados con cambios, errores y eventos.
  - Crear `application/` por familias cohesivas, con puertos bajo `application/ports/` solo para dependencias externas reales.
  - Normalizar la ubicacion fisica de la maquina canonica dentro de `domain/` al poder actualizar todos sus consumidores y checks en un unico slice.
  - Migrar por familias manteniendo contratos externos.
  - Anadir tests con fakes deterministas.

  Actualizacion del contexto del proyecto:
  - Relacionar en `domain.md` requirements y permisos con los casos de uso responsables.
  - Definir en `architecture.md` application layer, puertos y direccion de dependencias.
  - Actualizar `AGENTS.md` con una referencia al mapa de casos de uso.
  - Automatizar localmente las reglas de imports descritas en `architecture.md`.

  Restricciones:
  - Los casos de uso no reciben sockets.
  - `application/` no importa Fastify, Socket.IO ni implementaciones de `infrastructure/`.
  - No crear una interfaz por funcion sin limite real.
  - No crear carpetas genericas `services`, `helpers`, `managers` o `utils`.
  - No cambiar contratos publicos.
  - No copiar estas reglas a agentes SDD genericos.

  Validacion:
  - Los handlers migrados delegan en casos de uso.
  - Los casos de uso se prueban sin red.
  - Autorizacion y errores coinciden con `domain.md`.
  - Los tests de subdirectorios se descubren realmente y los checks prueban `application -> domain` sin aristas inversas.
status: implemented
spec: .harness/specs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md
design: .harness/designs/2026-07-21/d70c49e2-capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio.md
task_number: 02
task_count: 05
---

# Objetivo

Migrar inicio y retry a `gameUseCases.ts`, incluida la generacion determinista de mazo y la expiracion de dealing, para que sus handlers sean adaptadores wire y sus efectos temporales vuelvan por aplicacion con guardas stale.

# Alcance y evidencia

- Aplican `CA-01`, `CA-02`, `CA-03`, `CA-04`, `CA-06`, `CA-07`, `CA-09`, `CA-11` y la trazabilidad de `CA-12`.
- Implementar `startGame` y `retryGame` sobre `domain/setup.ts`, `Clock`, `RandomSource`, `RoomRepository`, publisher y scheduler; barajar con Fisher-Yates usando exclusivamente la fuente inyectada.
- Encauzar `dealing-expired` por `effectUseCases.ts` con el efecto original y las expectativas de fase/lock/deadline, cancelando o reemplazando trabajos anteriores por `{ roomCode, key }`.
- Migrar los handlers `game:start` y `game:retry` y retirar sus accesos directos a dominio, random, Maps de timers y traduccion duplicada de eventos.
- La linea base esta en `apps/backend/src/index.ts:314-320`, `368-390`, `1195-1252`, `domain/setup.ts`, `domain/round.ts:67-84` y los escenarios de inicio, autorizacion, retry y privacidad de `socketIntegration.test.ts`.
- No incluye ready/pausa, juego/progresion/CPU ni estrella; esos caminos permanecen temporalmente con un propietario unico hasta sus TASKs.

# Criterios de aceptacion

- **CA-02 / CA-07:** inicio y retry se ejecutan sin red con reloj, secuencia random, repositorio, publicador y scheduler falsos; ningun caso de uso recibe socket ni usa `Date.now`, `Math.random` o timers reales.
- **CA-03 / CA-04:** cada rechazo conserva literalmente el error observable y no guarda, publica ni programa; cada exito enumera cambios, eventos y efectos suficientes sin que el handler recalcule autorizacion, reparto, balance, lock o deadline.
- **CA-04:** inicio conserva host, lobby y minimo de dos conectados; retry conserva host y ventana vigente, reinicia nivel/recursos/manos/ready segun dominio y mantiene la sala.
- **CA-06:** inicio conserva snapshot versionado, `game:started`, log y ack en el orden baseline; retry conserva `game:restarted`, mensaje, log, version y ack sin cambiar contratos.
- **CA-07:** codigo de sala y mazo consumen `RandomSource`; el guardado funcional incrementa version una vez y el scheduler reemplaza dealing previo usando su clave estable.
- **CA-09:** ambos handlers delegan exclusivamente en `gameUseCases.ts`; desaparecen su barajado, mutacion, publicacion y scheduling previos del shell sin feature flag ni doble escritura.
- **CA-11:** fakes verifican determinismo, orden, una sola materializacion y expiraciones antes, en y despues de `dueAt`, incluida sala borrada, version distinta, retry y lock reemplazado.

# Tareas de implementacion

- **TI-01 — Caracterizar inicio y retry:** fijar tablas de host/invitado, lobby/partida/terminales, balance, reparto, ready humano/CPU, textos, versiones y orden wire antes de sustituir handlers.
- **TI-02 — Implementar mazo determinista:** mover generacion de codigos/mazo que corresponda al limite de aplicacion y hacer Fisher-Yates con `RandomSource`, con tests de secuencia y sin consumo adicional no observable.
- **TI-03 — Implementar casos de uso:** añadir `startGame` y `retryGame` a `gameUseCases.ts`, adaptar el resultado de dominio a cambios/eventos/efectos de aplicacion, guardar con version esperada y despachar una vez.
- **TI-04 — Materializar dealing:** implementar en `effectUseCases.ts` la expiracion declarada, recarga y validacion stale, commit y siguiente despacho; probar reemplazo/cancelacion por clave sin timers reales.
- **TI-05 — Migrar transporte:** redirigir ambos handlers, mantener parsers/contexto/ack en transporte y retirar del shell random, timers, helpers y traducciones que solo servian a esta familia.
- **TI-06 — Auditar propietario unico:** buscar llamadas directas a `domain/setup.ts`, `buildDeck`, Maps de dealing y emisiones de start/retry fuera de los propietarios permitidos, y eliminar restos activos.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests unitarios anidados de `gameUseCases` y `effectUseCases` con fakes, cubriendo todos los rechazos, inmutabilidad, mazos, cambios, orden, version y callbacks stale.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Exigir `>= 80%` en lineas, branches y funciones sobre codigo nuevo o modificado de esta familia y ejecutar las regresiones Socket.IO de inicio, rechazo por host, derrota/retry y permanencia de sala.
- Verificar con `layerBoundaries` y busqueda estatica ausencia de imports prohibidos, `Date.now`/`Math.random`/timers en aplicacion, handlers dobles y helpers antiguos activos.

# Documentacion aplicable

- Actualizar la matriz de `.harness/context/domain.md` para enlazar inicio y retry con `gameUseCases.ts`, `domain/setup.ts`, sus permisos y poblaciones.
- Mantener `.harness/context/architecture.md` sincronizado con el uso real de `Clock`, `RandomSource`, `Scheduler`, dispatcher y callbacks por `effectUseCases.ts`.
- Documentar junto al scheduler las claves y expectativas de dealing; no modificar aun `AGENTS.md` ni documentacion de contrato publico.

# Riesgos y restricciones

- Mitigar callbacks stale de una partida anterior con efecto original, version esperada y validacion de fase/lock/deadline antes de guardar.
- Mitigar orden/version divergente y doble materializacion comparando secuencia exacta y una sola llamada de publisher/scheduler por exito.
- Mantener un propietario unico durante el slice: no dejar handler nuevo junto a `buildDeck`, timer o mutacion anterior activa.
- No cambiar contracts, textos, balance, duraciones, frontend ni topologia; no introducir puertos adicionales, sockets en aplicacion o decisiones funcionales nuevas.
