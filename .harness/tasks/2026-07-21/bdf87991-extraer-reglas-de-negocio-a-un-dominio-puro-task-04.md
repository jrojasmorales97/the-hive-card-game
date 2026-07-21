---
id: bdf87991
slug: extraer-reglas-de-negocio-a-un-dominio-puro
type: task
created_at: 2026-07-21T17:47:23Z
created_by_command: /sdd:task
source_prompt: |-
  Quiero extraer las reglas de negocio desde `apps/backend/src/index.ts` hacia un dominio puro, modular y testeable.

  El objetivo no es aplicar DDD ceremonial, sino dar un unico propietario a cada regla.

  Alcance:
  - Identificar partida, ronda, jugador, mano, pila, vidas, estrellas, recompensas y consenso.
  - Extraer reglas de cartas, penalizacion, descartes, pausa, ready, estrella, nivel y final.
  - Reutilizar la maquina de estados canonica.
  - Expresar resultados mediante estado y/o eventos de dominio.
  - Migrar por slices eliminando la regla antigua al activar su reemplazo.

  Actualizacion del contexto del proyecto:
  - Actualizar `domain.md` con lenguaje ubicuo e invariantes confirmadas durante la extraccion.
  - Definir en `architecture.md` limites de domain, imports prohibidos, patrones y convenciones.
  - Registrar en `AGENTS.md` la referencia a la capa, sin duplicar sus reglas.
  - Implementar comprobaciones locales de imports basadas en `architecture.md`.

  Restricciones:
  - Domain no depende de Fastify, Socket.IO, timers, entorno, transporte o infraestructura.
  - No crear clases o interfaces por ceremonia.
  - No mantener reglas duplicadas.
  - No introducir estas restricciones en plantillas SDD genericas.

  Validacion:
  - Las reglas se prueban con datos deterministas.
  - Los limites definidos en `architecture.md` se comprueban automaticamente.
  - El comportamiento externo se conserva.
status: implemented
spec: .harness/specs/2026-07-20/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro.md
design: .harness/designs/2026-07-20/bdf87991-extraer-reglas-de-negocio-a-un-dominio-puro.md
task_number: 04
task_count: 05
---

# Objetivo

Migrar propuesta, votos, cancelacion, rechazo, consumo, preview y settlement de estrella al dominio puro, dejando en `starAnimation.ts` solo la coordinacion de acks visuales y timeout.

# Alcance y evidencia

- Aplican `CA-02`, `CA-05`, `CA-07`, `CA-08`, `CA-09` y `CA-12` de la SPEC.
- La evidencia actual esta en `apps/backend/src/index.ts:880-998`, handlers `1574-1683`, `gameTiming.ts:37-75`, `starResolution.ts`, `gameStateMachine.ts:161-194` y sus tests unitarios/integracion.
- Implementar `apps/backend/src/domain/star.ts` y `apps/backend/src/starAnimation.ts` conforme a D-06: consenso y settlement son negocio; `socketId`, acks y espera visual son infraestructura.
- Caracterizar propuesta, autoaceptacion del iniciador/CPU, voto repetido, consenso con conectados sin cartas, cancelacion solo por proponente, rechazo ajeno, desconexion, preview sin mutacion, settlement de manos no vacias aun desconectadas y consumo unico.
- No incluye cambiar el resultado posterior de progresion; el settlement debe emitir el outcome necesario para que su propietario actue sin recalcular la regla de estrella.

# Criterios de aceptacion

- **CA-05:** propuesta y votos respetan la maquina canonica; consenso incluye a todos los conectados aunque no tengan cartas, cancelacion solo corresponde al proponente y los demas pueden rechazar.
- **CA-05:** al completar consenso se consume una estrella exactamente una vez y se produce preview de la minima de cada mano no vacia, incluidas manos desconectadas, sin mutarlas antes del cierre visual.
- **CA-05:** settlement es un comando idempotente que aplica exactamente ese preview una vez; voto, ack o timeout repetidos no vuelven a consumir ni descartar.
- **CA-07:** lock/timeout de estrella llevan fase, razon y deadline esperados; callbacks stale, retry o reemplazo de lock no alteran estado.
- **CA-08:** eventos de propuesta, aceptacion, cancelacion/rechazo, uso, preview, descarte y settlement contienen lo necesario para emisiones/logs y continuacion sin recalculo del shell.
- **CA-09:** decisiones equivalentes de `resolveStarIfEveryoneAccepted`, `resolveStar`, `finalizeStarResolution`, `gameTiming.ts` y `starResolution.ts` se retiran al conectar todos los handlers.
- **CA-12:** `game:star-used`, logs, version, snapshots, privacidad, ack de animacion, desconexion y timeout conservan su comportamiento observable y orden.

# Tareas de implementacion

- **TI-01 — Caracterizar estrella:** ampliar tests tabulares y Socket.IO para propuestas, votos repetidos, CPU, cancelacion/rechazo, participante conectado sin cartas, desconectado con cartas, preview, acks parciales/completos, timeout y retry/stale.
- **TI-02 — Implementar `domain/star.ts`:** autorizar comandos con la maquina, producir estado/eventos/efectos inmutables para propuesta, aceptacion, cancelacion, rechazo, consenso, consumo, preview y settlement idempotente.
- **TI-03 — Separar animacion:** crear `starAnimation.ts` para registrar solo IDs/sockets que deben confirmar, aceptar acks/desconexion y vencer la espera; al completar, enviar al dominio el comando de settlement con expectativas originales sin tocar manos ni estrellas.
- **TI-04 — Conectar handlers y scheduler:** migrar `star:propose`, `star:accept`, `star:cancel`, `star:reject`, `star:discard-animation-complete` y timeout para aplicar resultados una vez y traducir eventos en el orden baseline.
- **TI-05 — Retirar reglas antiguas:** eliminar o absorber preview/aplicacion de descarte, consenso, consumo y settlement de `index.ts`, `gameTiming.ts` y `starResolution.ts`; conservar solo infraestructura real en `starAnimation.ts` y mover/ajustar tests con su propietario.
- **TI-06 — Auditar unicidad y privacidad:** buscar mutaciones directas de estrellas/manos desde acks o timers, asegurar que desconectados con cartas se incluyen solo en settlement y comparar snapshots publicos/privados.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests deterministas de `domain/star.ts` para igualdad profunda, no mutacion e idempotencia de votos, consumo y settlement; probar `starAnimation.ts` como infraestructura con acks, desconexion y timeout controlados.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Mantener `>= 80%` en lineas, branches y funciones del limite y cubrir las ramas modificadas de coordinacion/adaptacion cuando sean medibles.
- Confirmar `npm run check:domain`, ausencia de mutaciones directas desde `starAnimation.ts`, ausencia de propietarios antiguos y regresion del escenario Socket.IO de estrella completo.

# Documentacion aplicable

- Actualizar `.harness/context/domain.md` con las poblaciones distintas de consenso y settlement, consumo unico, preview y settlement idempotente.
- Actualizar `.harness/context/architecture.md` con la frontera confirmada entre hechos de dominio y acks visuales solo si requiere precision frente al diseno aprobado.

# Riesgos y restricciones

- Mitigar R-03 validando expectativas temporales y R-06 separando preview de mutacion y haciendo settlement idempotente.
- Mitigar R-01 y R-04 preservando orden observable y retirando las decisiones antiguas en el mismo slice.
- `starAnimation.ts` no puede decidir participantes de consenso/settlement, consumir estrellas ni modificar manos; el dominio no conoce sockets, acks o timers.
- No cambiar contratos/frontend ni anticipar el descarte antes del cierre vigente.
