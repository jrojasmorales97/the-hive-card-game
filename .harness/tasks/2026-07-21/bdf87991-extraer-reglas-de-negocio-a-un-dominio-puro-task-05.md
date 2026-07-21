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
task_number: 05
task_count: 05
---

# Objetivo

Migrar recompensas, topes, avance de nivel, derrota, victoria y ranking final al dominio, y cerrar la extraccion eliminando propietarios transitorios, consolidando documentacion y validando el sistema completo.

# Alcance y evidencia

- Aplican `CA-01`, `CA-02`, `CA-06`, `CA-07`, `CA-08`, `CA-09`, `CA-10`, `CA-11`, `CA-12` y `CA-13` de la SPEC.
- Implementar `apps/backend/src/domain/progression.ts` y `scoring.ts`; reutilizar setup para el siguiente reparto y conservar `gameStateMachine.ts` como autoridad de expiraciones y terminales.
- La evidencia actual esta en `apps/backend/src/index.ts:605-717`, `roundResolution.ts`, `levelFlow.ts`, `finalScoring.ts` y sus tests, mas los escenarios Socket.IO de derrota/retry y victoria completa.
- Caracterizar reward map vigente, topes de cinco vidas/tres estrellas, derrota sin vidas, cierre/avance temporizado, victoria en `maxLevel`, retry y orden estable del ranking con `now`, tiempos y errorCounts fijos.
- Cerrar el inventario completo contra `index.ts`, helpers, dominio, contexts, README y AGENTS; no modificar contracts ni plantillas SDD.

# Criterios de aceptacion

- **CA-06:** al completar nivel se aplica la recompensa vigente una vez con topes 5/3; se produce derrota al quedar sin vidas y victoria al completar `maxLevel`; el siguiente nivel incrementa, reparte mediante setup y conserva locks/tiempos observables.
- **CA-06:** `domain/scoring.ts` reproduce exactamente el ranking, bandas, penalizaciones, mensajes y orden estable actuales con `completedAt` inyectado, sin reinterpretar el alcance temporal de `pileHistory`.
- **CA-07:** cierre de ronda, avance y readiness del siguiente nivel se autorizan mediante la maquina y rechazan expiraciones stale con expectativas completas.
- **CA-08 / CA-09:** eventos de nivel, recompensa, siguiente nivel, derrota, victoria y resultados contienen toda la decision; `completeLevelOrGame`, `applyLevelReward`, calculos terminales y `finalScoring.ts` dejan de ser propietarios activos.
- **CA-01 / CA-13:** cada regla de la SPEC tiene un unico propietario final, no quedan helpers vacios/reexports ni abstracciones ceremoniales, y `.harness/templates/` permanece sin cambios.
- **CA-10 / CA-11:** `domain.md`, `architecture.md`, `AGENTS.md` y README reflejan el codigo final y comandos reales; la guarda y el gate de 80% pasan sobre todo el limite.
- **CA-12:** backend y frontend conservan contracts, acks, eventos, logs, orden, versiones, snapshots, privacidad, derrota/retry y victoria completa.

# Tareas de implementacion

- **TI-01 — Caracterizar progresion y final:** ampliar tests tabulares para recompensas/topes, expiraciones, derrota, victoria, retry y scoring con historial/errorCounts/tiempos fijos; conservar el recorrido Socket.IO completo hasta nivel 12.
- **TI-02 — Implementar progresion:** crear `domain/progression.ts` para cierre de nivel, recompensa, terminales y avance, invocando la maquina y setup, y devolviendo estado, eventos y efectos inmutables con reloj/duraciones inyectados.
- **TI-03 — Mover scoring:** trasladar sin cambios funcionales el calculo de `finalScoring.ts` a `domain/scoring.ts`, adaptar tipos funcionales/wire en la frontera y mantener orden, CPU, mensajes, bandas y penalizaciones cubiertos.
- **TI-04 — Conectar y retirar:** migrar callbacks/consumidores de nivel, game over y victory; traducir eventos desde el adaptador y eliminar `completeLevelOrGame`, `applyLevelReward`, `finalizeGameResults`, `finalScoring.ts`, `roundResolution.ts`, `levelFlow.ts` o cualquier resto que quede sin responsabilidad permitida.
- **TI-05 — Auditar propiedad final:** buscar simbolos, calculos y mutaciones antiguas de todas las familias migradas; eliminar helpers vacios/reexports transitorios y confirmar que `index.ts` contiene solo transporte, registros de proceso, serializacion, emisiones y scheduler.
- **TI-06 — Consolidar documentacion:** actualizar `domain.md` con lenguaje/invariantes y propietarios finales; `architecture.md` con limite y convenciones ejecutables; `AGENTS.md` solo con referencias; README con inicio manual del host y comandos de dominio.
- **TI-07 — Ejecutar cierre integral:** revisar el diff para contracts/frontend/plantillas, ejecutar toda la matriz canonica backend/frontend y registrar cualquier riesgo residual como evidencia, sin cambiar requisitos ni arquitectura.

# Validacion y cobertura

Objetivo de cobertura: `>= 80%` sobre el codigo nuevo o modificado cuando sea medible.

- Ejecutar tests deterministas de `domain/progression.ts` y `domain/scoring.ts`, incluidas repeticiones sobre la misma entrada, inmutabilidad, topes, terminales, stale timers y orden estable.
- Ejecutar `docker compose run --build --rm --no-deps backend npm test`, `docker compose run --build --rm --no-deps backend npm run test:coverage` y `docker compose run --build --rm --no-deps backend npm run build`.
- Ejecutar `docker compose run --build --rm --no-deps frontend npm test`, `docker compose run --build --rm --no-deps frontend npm run test:coverage` y `docker compose run --build --rm --no-deps frontend npm run build`.
- Exigir `>= 80%` en lineas, branches y funciones del limite completo, confirmar `npm run check:domain`, la linea base de integracion y ausencia por busqueda de propietarios antiguos, imports/globales prohibidos y cambios en `.harness/templates/`.

# Documentacion aplicable

- Actualizar `.harness/context/domain.md` con lenguaje ubicuo, invariantes confirmadas e inventario final de propietarios; conservar incertidumbres no confirmadas.
- Actualizar `.harness/context/architecture.md` contra el codigo final con limite fisico/logico, dependencias, resultados, eventos/efectos, adaptador, scheduler, checker, gate y patron de slice.
- Actualizar `AGENTS.md` solo como indice hacia ambos contexts, `apps/backend/src/domain/` y `gameStateMachine.ts`, sin copiar reglas normativas.
- Corregir README para inicio manual por host con dos conectados y documentar `check:domain`/validacion; no ampliar alcance funcional.

# Riesgos y restricciones

- Mitigar R-01 con regresion integral del orden observable, R-03 con expectativas stale y R-04 con auditoria de propietarios finales.
- Mitigar R-07/R-08 verificando gate y checker; mitigar R-09 caracterizando y conservando exactamente el historial que usa scoring, aunque `dealLevel()` lo reinicie.
- No cambiar contracts ni comportamiento frontend, no agregar persistencia/dependencias ceremoniales, no introducir reglas del proyecto en plantillas SDD y no reabrir decisiones aprobadas.
- El cierre no esta completo si queda cualquier camino activo que recalcule elegibilidad, penalizaciones, recursos, progreso, terminales o scoring fuera de su propietario canonico.
