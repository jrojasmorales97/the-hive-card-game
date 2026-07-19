# Roadmap de refactor integral gobernado por contexto de proyecto

## Proposito

Este documento organiza el refactor incremental de The Hive desde la arquitectura monolitica actual hacia un monolito modular mantenible. Cada fase parte de una peticion natural que debe pasar por el flujo SDD generico:

```text
scout -> plan -> implement -> review
```

Los comandos, agentes y plantillas SDD son infraestructura reutilizable. No deben contener reglas del juego, nombres de capas de The Hive, convenciones locales ni decisiones de este repositorio.

El contexto especifico vigente de The Hive se reparte en estos tres documentos:

- `AGENTS.md`: indice de contexto funcional y tecnico, artefactos SDD, skills disponibles y orden de lectura para investigar el producto, la arquitectura, el contrato realtime y el cliente.
- `.harness/context/domain.md`: proposito y contexto funcional observados, log de requerimientos con su estado y evidencia, funcionalidades implementadas o pendientes y glosario de terminos del juego.
- `.harness/context/architecture.md`: stack, capas, estrategia de carpetas, convenciones, reglas de legibilidad, patrones y antipatrones, paquetes instalados y comandos disponibles de arranque y testing.

La unica adaptacion admisible en la infraestructura SDD generica es que sepa descubrir el archivo de instrucciones del repositorio y seguir las referencias de contexto declaradas en el. No debe conocer el contenido especifico de esos documentos.

## Separacion de responsabilidades

### `AGENTS.md`

`AGENTS.md` funciona actualmente como indice de contexto. Contiene:

- Referencias a los contextos funcional y tecnico, con indicaciones de cuando consultarlos.
- Ubicacion de los artefactos SDD y la aclaracion de que no hay historial versionado disponible.
- Inventario de skills locales observadas y cuando usarlas.
- Orden de lectura que comienza en `README.md`, continua con ambos contextos y dirige despues al backend y frontend principales.

No desarrolla las reglas completas del juego ni las convenciones extensas de arquitectura; deriva esas consultas a los documentos de contexto correspondientes.

### `domain.md`

`.harness/context/domain.md` recoge el baseline funcional observado. Contiene:

- Proposito del proyecto y contexto funcional, incluyendo la separacion backend/frontend, el estado en memoria y las funcionalidades ya cubiertas.
- Log de requerimientos con fecha, requerimiento, estado y fuentes de evidencia.
- Inventario de funcionalidades: lobby, reconexion, estados publico y privado, rondas, cartas, penalizaciones, estrella, progresion, ranking final y modo dev-cpu.
- Glosario de los conceptos que maneja la implementacion actual, como sala, jugador, host, ready, pila, vida, estrella, bloqueo de interaccion y snapshot.

Incluye referencias concretas al codigo como evidencia de cada afirmacion; por ello no separa de forma estricta los hechos funcionales de los detalles tecnicos que los respaldan.

### `architecture.md`

`.harness/context/architecture.md` describe la arquitectura actual observada. Contiene:

- Stack de backend y frontend, desarrollo con Docker Compose, despliegue observado y estrategia de testing.
- Capas actuales, estrategia de carpetas y convenciones TypeScript de ambos paquetes.
- Reglas de legibilidad para helpers, estado publico y privado, envelopes versionados y logs acotados.
- Patrones presentes para estado autoritativo en memoria, eventos Socket.IO, locks, reconexion, proxy local y tests co-localizados.
- Antipatrones evitados, inventario de dependencias directas y comandos de arranque, build, testing y cobertura.

Tambien cita reglas funcionales cuando son necesarias para explicar limites tecnicos, por ejemplo la privacidad de las manos o la autoridad del backend.

### Infraestructura SDD generica

Los comandos y agentes SDD deben limitarse a:

1. Descubrir `AGENTS.md` o el archivo de instrucciones equivalente del repositorio.
2. Leer las referencias de contexto que este declare.
3. Citar las fuentes utilizadas en scouts, planes, implementaciones y reviews.
4. Informar cuando una referencia requerida no existe o esta desactualizada.
5. Mantener su logica generica y reutilizable entre repositorios.

No deben contener reglas como `domain no importa Socket.IO`, nombres de eventos del juego o limites de lineas propios de The Hive. Esas reglas pertenecen a `architecture.md`.

## Principios rectores

- Refactor incremental, nunca big-bang.
- Functional Core, Imperative Shell.
- DDD tactico solo donde exista complejidad real.
- SOLID como heuristica local, no como generador de interfaces.
- Estado del juego autoritativo en backend.
- Contratos explicitos y validados.
- Dependencias dirigidas hacia el dominio.
- Features frontend con APIs publicas pequenas.
- Caracterizacion antes de extraccion.
- Una sola ruta activa por comportamiento.
- Toda regla arquitectonica debe responder a un riesgo real.

## Protocolo de orquestacion

Cada fase sigue este proceso:

1. Scout del codigo y de los documentos de contexto afectados.
2. Plan SDD con decisiones materiales cerradas.
3. Implementacion por slices verticales.
4. Actualizacion de `domain.md`, `architecture.md` y/o `AGENTS.md` segun ownership.
5. Tests, cobertura, typecheck, build y validacion manual cuando aplique.
6. Review independiente con evaluacion 4R y conformidad con el contexto del proyecto.
7. Plan correctivo para findings materiales antes de avanzar.

Una fase queda bloqueada cuando:

- `Risk <= 2` o `Reliability <= 2`.
- Existen findings altos pendientes.
- Los tests no pasan o no se descubren realmente.
- Hay dos rutas activas para el mismo comportamiento.
- La documentacion de contexto diverge del codigo.
- Una decision funcional esta en `architecture.md` pero no en `domain.md`.
- Una convencion tecnica esta en `domain.md` pero no en `architecture.md`.

## Evolucion del contexto por fase

| Fase | `AGENTS.md` | `domain.md` | `architecture.md` |
| --- | --- | --- | --- |
| 00 | Convertir en indice | Crear desde contexto funcional existente | Normalizar estructura y direccion objetivo |
| 01 | Enlazar baseline y comandos verificados | Consolidar reglas e incertidumbres | Registrar arquitectura real y estrategia de tests |
| 02 | Enlazar fuente canonica de contratos | Registrar requisitos de privacidad y compatibilidad | Definir paquete, validacion y ownership de contratos |
| 03 | Enlazar modelo de fases | Canonizar fases, acciones e invariantes | Documentar implementacion de state machine |
| 04 | Registrar capa de dominio disponible | Refinar glosario e invariantes extraidas | Activar limites y convenciones de dominio |
| 05 | Registrar casos de uso disponibles | Enlazar requirements con casos de uso | Definir application layer y puertos |
| 06 | Registrar adaptadores operativos | Sin cambios salvo decision funcional | Definir ownership de efectos e infraestructura |
| 07 | Actualizar mapa de entrada backend | Registrar cambios solo si afectan comportamiento | Definir transporte delgado y composition root |
| 08 | Actualizar mapa de entrada frontend | Sin cambios salvo decision funcional | Definir ownership de estado y gateway frontend |
| 09 | Actualizar indice de features | Enlazar features con capacidades del producto | Definir limites y convenciones de features |
| 10 | Dejar indice final estable | Cerrar requirements y dudas resueltas | Consolidar enforcement y retirar excepciones |

## Fase 00 - Preparar el contexto del proyecto

### Resultado esperado

The Hive dispone de un harness documental claro sin especializar la infraestructura SDD generica.

### Cambios de contexto

- Convertir `AGENTS.md` en indice de referencias y comandos.
- Crear `domain.md` a partir de contenido funcional verificado de `business.md`, README, planes y codigo.
- Reestructurar `architecture.md` como fuente tecnica actual y objetivo.
- Marcar `business.md` como fuente legacy temporal o retirarlo cuando `domain.md` cubra su contenido.
- Mantener `.harness/templates/` generico.
- Si el SDD no descubre contexto, modificarlo solo para leer `AGENTS.md` y seguir referencias declaradas.

### Prompt de entrada SDD

```text
Quiero preparar el contexto especifico de The Hive antes de iniciar su refactor integral, manteniendo genericos y reutilizables los comandos, agentes y plantillas SDD.

Objetivos:
- Convertir `AGENTS.md` en un indice corto de referencias y operacion.
- Crear `domain.md` como fuente de verdad funcional.
- Normalizar `architecture.md` como fuente de verdad tecnica.
- Definir como los agentes descubren esos documentos sin introducir conocimiento de The Hive en el SDD generico.

Alcance:
- Revisar `AGENTS.md`, `business.md`, `architecture.md`, README, planes y codigo actual.
- Mover a `domain.md` proposito, contexto, glosario, actores, reglas, invariantes, dudas y requirements log.
- Mantener en `architecture.md` stack, capas, patrones, convenciones, testing, legibilidad, arquitectura actual y objetivo.
- Reducir `AGENTS.md` a comandos canonicos, orden de lectura, referencias y estado de migracion.
- Definir un protocolo generico de descubrimiento: leer instrucciones del repo y seguir sus referencias.
- Documentar ownership para evitar duplicacion entre los tres archivos.

Restricciones:
- No anadir reglas de The Hive a `.harness/templates/`, comandos o agentes genericos.
- No refactorizar todavia backend o frontend.
- No cambiar comportamiento del juego.
- No duplicar una regla completa en varios documentos.
- No eliminar `business.md` hasta demostrar que su informacion vigente esta migrada.

Validacion:
- Una tarea funcional encuentra sus reglas en `domain.md` siguiendo `AGENTS.md`.
- Una tarea tecnica encuentra sus convenciones en `architecture.md` siguiendo `AGENTS.md`.
- Los comandos SDD siguen siendo validos para otros repositorios.
- Ninguna funcionalidad del juego cambia.
```

## Fase 01 - Baseline y red de seguridad

### Resultado esperado

El comportamiento actual queda caracterizado antes de mover responsabilidades.

### Cambios de contexto

- `domain.md`: consolidar reglas observadas, casos limite, incertidumbres y requirements existentes.
- `architecture.md`: registrar eventos, timers, snapshots, estado publico/privado y estrategia de tests de integracion.
- `AGENTS.md`: enlazar comandos Docker verificados y documentos de baseline.
- Infraestructura SDD: sin reglas nuevas especificas.

### Prompt de entrada SDD

```text
Quiero construir una red de seguridad para el refactor de The Hive sin cambiar su comportamiento funcional.

Objetivos:
- Inventariar eventos Socket.IO, payloads, acknowledgements y errores.
- Documentar fases, timers, locks e invariantes observados.
- Distinguir estado publico, privado y datos que nunca deben difundirse.
- Crear tests de caracterizacion y soporte de integracion Socket.IO.

Flujos minimos:
- Crear, unirse y reconectar a sala.
- Inicio y ready-up.
- Juego correcto y penalizacion.
- Pausa y reanudacion.
- Propuesta, voto y resolucion de estrella.
- Jugadores sin cartas.
- Final de nivel, derrota, victoria y retry.

Actualizacion del contexto del proyecto:
- Registrar reglas y casos limite confirmados en `domain.md`.
- Registrar eventos, snapshots, timers y estrategia de testing en `architecture.md`.
- Anadir al requirements log las incertidumbres detectadas, sin resolverlas silenciosamente.
- Mantener `AGENTS.md` como indice hacia esos documentos y comandos canonicos.

Restricciones:
- No reorganizar arquitectura.
- No redisenar UI ni cambiar reglas.
- Solo introducir seams minimos para testing.
- No especializar comandos o plantillas SDD.

Validacion:
- Los tests se ejecutan mediante Docker Compose.
- Existe al menos una prueba Socket.IO real.
- `domain.md` y `architecture.md` describen el baseline real.
- Los tests actuales siguen pasando.
```

## Fase 02 - Contratos compartidos

### Resultado esperado

Frontend y backend consumen contratos canonicos con validacion runtime y privacidad explicita.

### Cambios de contexto

- `domain.md`: requisitos de privacidad, compatibilidad y semantica de mensajes.
- `architecture.md`: ubicacion canonica, ownership, versionado, validacion y reglas de import.
- `AGENTS.md`: referencia al paquete o modulo de contratos.
- Infraestructura SDD: solo debe descubrir las referencias; no conoce eventos concretos.

### Prompt de entrada SDD

```text
Quiero establecer contratos canonicos y verificables entre backend y frontend de The Hive sin cambiar nombres de eventos ni comportamiento observable.

Objetivos:
- Eliminar tipos duplicados y diferencias de interpretacion.
- Centralizar eventos, payloads, acknowledgements, snapshots, fases, locks y acciones.
- Validar entradas externas en runtime.
- Mantener explicita la separacion entre estado publico y privado.

Alcance:
- Decidir una ubicacion canonica compatible con Docker y despliegue.
- Migrar contratos por familias de eventos.
- Eliminar `any` en limites migrados.
- Anadir tests de contrato, invalid input y privacidad.

Actualizacion del contexto del proyecto:
- Registrar en `domain.md` requisitos funcionales de privacidad y compatibilidad.
- Registrar en `architecture.md` fuente canonica, consumidores, validacion y convenciones de contratos.
- Actualizar `AGENTS.md` solo con la referencia al contrato canonico.

Restricciones:
- No cambiar reglas ni renombrar eventos.
- No crear un archivo masivo de tipos.
- No introducir detalles de contratos de The Hive en comandos SDD.

Validacion:
- Ambos servicios consumen la misma fuente.
- Las entradas invalidas se rechazan de forma controlada.
- Ningun snapshot publico expone manos.
- Docker Compose y tests de caracterizacion siguen funcionando.
```

## Fase 03 - Estados e invariantes

### Resultado esperado

Fases, transiciones y acciones permitidas tienen una definicion canonica y testeable.

### Cambios de contexto

- `domain.md`: fases desde negocio, acciones, participantes e invariantes.
- `architecture.md`: representacion tecnica de la maquina de estados y testing.
- `AGENTS.md`: enlace al modelo canonico de fases.
- Infraestructura SDD: sin conocimiento de nombres de fases.

### Prompt de entrada SDD

```text
Quiero hacer explicita la maquina de estados de The Hive antes de extraer el dominio.

Objetivos:
- Centralizar fases, transiciones y acciones permitidas.
- Separar elegibilidad para jugar, ready, pausa y consenso.
- Evitar interpretaciones incompatibles en distintos handlers o componentes.

Alcance:
- Inventariar transiciones y eventos que las provocan.
- Modelar transiciones validas, invalidas y errores.
- Modelar locks y transiciones temporizadas sin depender de Socket.IO.
- Anadir tests directos por transicion.

Actualizacion del contexto del proyecto:
- Canonizar en `domain.md` nombres, significado, acciones e invariantes de cada fase.
- Documentar en `architecture.md` la implementacion tecnica y regla de fuente unica.
- Mantener `AGENTS.md` como indice hacia ambos apartados.

Restricciones:
- No mover todavia handlers.
- No usar una libreria de state machines sin justificacion material.
- No mezclar estado visual con estado de dominio.
- No especializar el SDD con fases de The Hive.

Validacion:
- Cada transicion modificada esta cubierta directamente.
- Ready, juego y consenso tienen reglas independientes.
- Existe una unica interpretacion tecnica de las fases.
```

## Fase 04 - Dominio backend

### Resultado esperado

Las reglas del juego viven en modulos puros sin dependencias de framework o infraestructura.

### Cambios de contexto

- `domain.md`: refinar glosario, agregados conceptuales e invariantes confirmadas.
- `architecture.md`: definir capa domain, dependencias permitidas, naming y reglas de pureza.
- `AGENTS.md`: enlazar ubicacion del dominio.
- Enforcement local: comprobar imports segun `architecture.md`, sin codificar esas reglas en SDD.

### Prompt de entrada SDD

```text
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
```

## Fase 05 - Casos de uso

### Resultado esperado

Las intenciones externas se coordinan mediante casos de uso sin conocimiento del transporte.

### Cambios de contexto

- `domain.md`: enlazar requirements con capacidades y autorizaciones.
- `architecture.md`: definir application layer, puertos, resultados y errores.
- `AGENTS.md`: enlazar mapa de casos de uso.
- Enforcement local: imports permitidos de application.

### Prompt de entrada SDD

```text
Quiero introducir una capa de aplicacion que orqueste el dominio sin depender de Socket.IO.

Alcance:
- Crear casos de uso para sala, reconexion, inicio, ready, jugar, pausa, estrella, retry y desconexion.
- Definir dependencias para repositorio, eventos, reloj, random y scheduler.
- Devolver resultados tipados con cambios, errores y eventos.
- Migrar por familias manteniendo contratos externos.
- Anadir tests con fakes deterministas.

Actualizacion del contexto del proyecto:
- Relacionar en `domain.md` requirements y permisos con los casos de uso responsables.
- Definir en `architecture.md` application layer, puertos y direccion de dependencias.
- Actualizar `AGENTS.md` con una referencia al mapa de casos de uso.
- Automatizar localmente las reglas de imports descritas en `architecture.md`.

Restricciones:
- Los casos de uso no reciben sockets.
- No crear una interfaz por funcion sin limite real.
- No cambiar contratos publicos.
- No copiar estas reglas a agentes SDD genericos.

Validacion:
- Los handlers migrados delegan en casos de uso.
- Los casos de uso se prueban sin red.
- Autorizacion y errores coinciden con `domain.md`.
```

## Fase 06 - Infraestructura y efectos

### Resultado esperado

Almacenamiento in-memory, timers, reloj y random quedan tras adaptadores controlables.

### Cambios de contexto

- `domain.md`: solo cambia si aparece una decision funcional.
- `architecture.md`: ownership de efectos, lifecycle, cleanup, puertos y adaptadores.
- `AGENTS.md`: enlazar adaptadores y comandos relevantes.
- Enforcement local: domain/application no importan implementaciones concretas.

### Prompt de entrada SDD

```text
Quiero encapsular la infraestructura backend detras de puertos manteniendo el comportamiento in-memory.

Alcance:
- Encapsular stores de salas y jugadores.
- Crear adaptadores para reloj, barajado y scheduler.
- Centralizar creacion, cancelacion y reemplazo de timers.
- Definir ownership y cleanup de recursos.
- Permitir tests deterministas con adaptadores fake.

Actualizacion del contexto del proyecto:
- Registrar en `architecture.md` puertos, adaptadores, ownership de efectos y reglas de cleanup.
- Actualizar `domain.md` solo si se descubre una decision funcional, no con detalles tecnicos.
- Mantener `AGENTS.md` como indice hacia adaptadores y comandos.
- Automatizar los limites tecnicos desde tooling local del repo.

Restricciones:
- No anadir base de datos.
- No cambiar balance ni reglas.
- No esconder efectos en funciones aparentemente puras.
- No especializar comandos SDD.

Validacion:
- Domain y application no dependen de infraestructura concreta.
- Los tests controlan reloj, random y scheduler.
- No quedan timers huerfanos en los flujos cubiertos.
```

## Fase 07 - Adaptadores Socket.IO

### Resultado esperado

Fastify y Socket.IO quedan como adaptadores delgados; `index.ts` es composition root.

### Cambios de contexto

- `domain.md`: actualizar solo si cambia un comportamiento aprobado.
- `architecture.md`: convenciones de handlers, serializacion, composition root e integracion.
- `AGENTS.md`: actualizar mapa de entrada backend.
- Enforcement local: transport no contiene reglas ni accede a infraestructura fuera de puertos aprobados.

### Prompt de entrada SDD

```text
Quiero convertir Socket.IO y Fastify en adaptadores delgados sobre los casos de uso.

Alcance:
- Separar handlers por familias funcionales.
- Centralizar contexto de socket, acknowledgements, emisiones y snapshots.
- Validar input y delegar inmediatamente.
- Migrar por familias eliminando handlers legacy.
- Anadir tests Socket.IO de exito, error, reconexion y privacidad.

Actualizacion del contexto del proyecto:
- Definir en `architecture.md` convenciones de transporte, composition root y serializacion.
- Actualizar `AGENTS.md` con el nuevo mapa de entrada backend.
- Actualizar `domain.md` solo ante decisiones funcionales explicitas.
- Automatizar localmente que transport no importe internals prohibidos.

Restricciones:
- Los handlers no deciden reglas, fases o timers.
- No cambiar eventos publicos.
- No mantener rutas antiguas y nuevas simultaneas.
- No introducir eventos de The Hive en plantillas genericas.

Validacion:
- `index.ts` contiene startup y composicion.
- Los handlers son delgados.
- Contratos, privacidad y reconexion estan cubiertos por integracion.
```

## Fase 08 - Estado frontend

### Resultado esperado

Existe un gateway Socket.IO unico y ownership claro para estado de servidor, conexion, UI y animacion.

### Cambios de contexto

- `domain.md`: sin cambios salvo comportamiento nuevo aprobado.
- `architecture.md`: ownership de estado, gateway, reducer y sincronizacion.
- `AGENTS.md`: actualizar entrada frontend.
- Enforcement local: componentes no importan Socket.IO ni registran listeners.

### Prompt de entrada SDD

```text
Quiero separar en frontend el estado autoritativo del servidor, conexion, UI y animaciones.

Alcance:
- Crear un unico gateway Socket.IO.
- Traducir eventos a un reducer o modelo explicito.
- Separar `serverState`, `connectionState`, `uiState` y `animationState`.
- Mantener backend como autoridad.
- Preservar reconexion, snapshots versionados y overlays.
- Migrar progresivamente sin redisenar UI.

Actualizacion del contexto del proyecto:
- Documentar en `architecture.md` ownership, fuente de verdad, sincronizacion y reglas de acceso a Socket.IO.
- Actualizar `AGENTS.md` con la entrada principal frontend.
- Cambiar `domain.md` solo si aparece una decision funcional real.
- Automatizar localmente la prohibicion de Socket.IO en componentes.

Restricciones:
- No introducir una libreria global sin necesidad demostrada.
- No duplicar reglas backend.
- No migrar todas las features de una vez.
- No codificar convenciones React locales en SDD generico.

Validacion:
- Existe un unico punto de entrada Socket.IO.
- No se mezclan snapshots de versiones distintas.
- Los componentes reciben estado y comandos explicitos.
```

## Fase 09 - Features frontend

### Resultado esperado

`App.tsx` queda como composicion de features con ownership y APIs claras.

### Cambios de contexto

- `domain.md`: mapear capacidades de producto a features sin incluir estructura interna.
- `architecture.md`: limites app/features/shared, APIs publicas y legibilidad frontend.
- `AGENTS.md`: indice de features y entrypoints.
- Enforcement local: imports y ciclos entre features.

### Prompt de entrada SDD

```text
Quiero descomponer `apps/frontend/src/App.tsx` en features verticales sin cambiar el diseno ni el comportamiento.

Features objetivo:
- Acceso y reconexion.
- Lobby.
- Mesa de juego.
- Ready y pausa.
- Consenso de estrella.
- Mano y pila.
- Logs.
- Final de nivel.
- Resultados y retry.

Alcance:
- Extraer una feature por slice.
- Separar presentacion y coordinacion.
- Mantener sockets y estado autoritativo fuera de componentes.
- Crear `shared` solo con reutilizacion demostrada.
- Eliminar codigo antiguo de `App.tsx` tras cada migracion.

Actualizacion del contexto del proyecto:
- Relacionar en `domain.md` capacidades del producto con sus features visibles.
- Definir en `architecture.md` limites, APIs, naming, folding y reglas de legibilidad frontend.
- Actualizar `AGENTS.md` con el indice de features.
- Automatizar imports permitidos y deteccion de ciclos desde tooling local.

Restricciones:
- No redisenar UI.
- No crear carpetas genericas.
- No importar internals de otra feature.
- No trasladar estas convenciones a comandos SDD genericos.

Validacion:
- `App.tsx` compone features.
- No hay ciclos ni imports internos cruzados.
- Desktop, mobile y flujos criticos mantienen comportamiento.
```

## Fase 10 - Hardening y cierre

### Resultado esperado

El contexto del proyecto describe la arquitectura real y las reglas tecnicas estan automatizadas por tooling local, no por especializacion del SDD.

### Cambios de contexto

- `AGENTS.md`: dejar un indice final pequeno, estable y sin detalles duplicados.
- `domain.md`: cerrar requirements implementados, decisiones y dudas resueltas.
- `architecture.md`: consolidar stack, capas, patrones, convenciones, legibilidad y excepciones.
- Tooling local: activar quality gates finales y eliminar excepciones temporales.
- Infraestructura SDD: confirmar que sigue generica y solo descubre referencias.

### Prompt de entrada SDD

```text
Quiero cerrar el refactor de The Hive endureciendo su contexto y tooling local sin convertir el SDD generico en un harness especifico del proyecto.

Objetivos:
- Consolidar reglas funcionales en `domain.md`.
- Consolidar reglas tecnicas en `architecture.md`.
- Mantener `AGENTS.md` como indice breve.
- Automatizar limites mediante tooling del repositorio.
- Eliminar legacy, excepciones temporales y documentacion obsoleta.

Alcance:
- Revisar coherencia entre codigo, `AGENTS.md`, `domain.md` y `architecture.md`.
- Cerrar el requirements log y dudas resueltas.
- Activar lint, format, typecheck, tests, cobertura, build y reglas de dependencias.
- Alinear CI y Docker.
- Eliminar codigo muerto, adapters temporales y rutas duplicadas.
- Ejecutar regresion completa y smoke manual.

Actualizacion final del contexto:
- `AGENTS.md` solo contiene referencias, operacion y puntos de entrada.
- `domain.md` contiene glosario, reglas, invariantes y requirements vigentes.
- `architecture.md` contiene arquitectura real, convenciones y quality gates.
- Las excepciones restantes tienen motivo, responsable y condicion de retirada.
- Los comandos y plantillas SDD no contienen conocimiento de The Hive.

Restricciones:
- No introducir features.
- No reescribir modulos estables por estilo.
- No convertir metricas de tamano en dogmas.
- No mantener contexto duplicado.

Validacion:
- CI y Docker ejecutan comandos equivalentes.
- Imports prohibidos fallan mediante tooling local.
- No queda legacy activo.
- Tests, typecheck, cobertura y build pasan.
- Un agente nuevo puede orientarse leyendo `AGENTS.md` y siguiendo referencias.
- El SDD sigue siendo reutilizable en otro repositorio sin cambios de dominio.
```

## Checklist de cierre por fase

- El scout leyo `AGENTS.md` y las referencias relevantes.
- El plan distingue reglas funcionales de decisiones tecnicas.
- Cada criterio tiene validacion directa.
- La implementacion actualiza el documento propietario del contexto cambiado.
- No se duplican reglas entre `domain.md` y `architecture.md`.
- `AGENTS.md` sigue siendo un indice breve.
- No se introdujo conocimiento de The Hive en comandos o plantillas SDD.
- No queda legacy para los slices migrados.
- Tests relevantes pasan en Docker.
- Cobertura del codigo nuevo o modificado es >= 80%.
- Typecheck y build pasan o existe un bloqueo concreto.
- La review es positiva y no tiene findings altos pendientes.

## Estado del roadmap

| Fase | Estado inicial | Prerrequisito de salida |
| --- | --- | --- |
| 00 Contexto del proyecto | Completada | Indice, dominio y arquitectura con ownership claro |
| 01 Baseline | Completada | Caracterizacion Socket.IO, contexto baseline y tests Docker validados; evidencia: `.harness/implementations/2026-07-18/0.1-caracterizar-el-baseline-realtime-de-the-hive-con-tests-socket-io-y-contexto-actualizado-sin-cambiar-comportamiento-funcional-attempt-2.md` |
| 02 Contratos | Completada | Contratos compartidos, validación runtime y privacidad verificadas; evidencia: `.harness/implementations/2026-07-18/0.2-centralizar-y-validar-los-contratos-socket-io-compartidos-de-the-hive-sin-cambiar-el-comportamiento-observable.md` |
| 03 Estados | Completada | Maquina de estados, transiciones, locks, capacidades y Mermaid validados; evidencia: `.harness/implementations/2026-07-19/0.3-hacer-explicita-la-maquina-de-estados-de-the-hive-antes-de-extraer-el-dominio-attempt-2.md` |
| 04 Dominio | Bloqueada por 03 | Reglas puras sin duplicacion |
| 05 Aplicacion | Bloqueada por 04 | Casos de uso sin transporte |
| 06 Infraestructura | Bloqueada por 05 | Efectos encapsulados |
| 07 Socket.IO | Bloqueada por 06 | Transporte delgado |
| 08 Estado frontend | Bloqueada por 07 | Gateway y ownership claros |
| 09 Features frontend | Bloqueada por 08 | Features aisladas |
| 10 Hardening | Bloqueada por 09 | Contexto consistente, enforcement local y legacy eliminado |
