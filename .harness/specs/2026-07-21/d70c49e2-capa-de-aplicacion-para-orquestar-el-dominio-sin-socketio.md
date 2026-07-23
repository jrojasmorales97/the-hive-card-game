---
id: d70c49e2
slug: capa-de-aplicacion-para-orquestar-el-dominio-sin-socketio
type: spec
created_at: 2026-07-21T00:00:00Z
created_by_command: /sdd:spec
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
status: approved
approved_at: 2026-07-21T21:57:29Z
approved_by: user
---

# Solicitud refinada

Incorporar una capa de aplicacion que coordine el dominio y sus efectos externos sin conocer sockets ni depender de Socket.IO. La capa cubrira las familias de sala, reconexion, inicio, ready, jugar, pausa, estrella, retry y desconexion; declarara solo los limites externos necesarios para repositorio, publicacion de eventos, reloj, aleatoriedad y scheduler; y devolvera resultados tipados que expresen cambios, errores y eventos.

La migracion conservara los contratos publicos actuales, incluida su autorizacion, textos de error, acks, eventos, versionado y privacidad. Se realizara por familias en estados estables, retirando el camino previo de cada familia al activar su sustituto. La maquina de estados canónica se trasladara fisicamente a `domain/` solo en un slice que actualice todos sus consumidores y comprobaciones.

Se documentara el mapa de requisitos y permisos hacia sus casos de uso responsables, se automatizaran los limites de imports de la capa y se demostrara el comportamiento mediante tests sin red con fakes deterministas y descubrimiento recursivo real de tests.

# Propuesta funcional

- Definir un mapa trazable de familias y comandos: sala cubre crear, unirse, abandonar, expulsar y resync; reconexion cubre volver a asociar la identidad existente y conservar su estado; inicio, ready, jugar, pausa, estrella, retry y desconexion cubren respectivamente los comandos y transiciones ya expuestos, incluida la confirmacion visual de estrella cuando corresponda.
- Hacer que cada caso de uso reciba identidad y datos de comando, no sockets; consulte y actualice la sala mediante el repositorio, use reloj/aleatoriedad/scheduler como dependencias explícitas cuando la operacion lo requiera y entregue al exterior un resultado discriminado con rechazo o con cambios, eventos y efectos a materializar.
- Mantener en el dominio la autorizacion de fase, actor, lock, expiraciones y reglas de juego ya canónicas. La aplicacion orquesta resultados decididos por el dominio y no vuelve a decidir elegibilidad, penalizaciones, recursos, progreso, terminales ni settlement de estrella.
- Mantener la frontera realtime como adaptadora: valida payloads, obtiene el actor desde la conexion, invoca el caso de uso, traduce su resultado a los acks, snapshots, emisiones y logs existentes, y materializa los efectos autorizados sin cambiar los contratos externos.
- Agrupar casos de uso por familia cohesiva; los puertos representan únicamente repositorio de salas, eventos, reloj, aleatoriedad y scheduler cuando sean dependencias externas reales. No se introducen interfaces por cada funcion ni directorios genéricos prohibidos.
- Migrar una familia completa por slice: todos sus handlers y callbacks pasan al caso de uso, se conservan sus pruebas de caracterizacion y se elimina el flujo anterior antes de continuar. El traslado físico de la maquina canónica ocurre una sola vez con todos los imports, tests y checks actualizados.
- Actualizar `domain.md`, `architecture.md` y `AGENTS.md` como fuentes de trazabilidad hacia el mapa de casos de uso y sus límites, sin copiar reglas particulares en agentes SDD genéricos.
- Automatizar los checks locales para descubrir tests bajo subdirectorios y rechazar dependencias prohibidas o aristas inversas entre aplicacion y dominio; añadir fakes deterministas para repositorio, eventos, reloj, aleatoriedad y scheduler en las pruebas de los casos de uso.

# Criterios de aceptacion

## CA-01 — Cobertura de familias de casos de uso

**DADO** los flujos actuales de sala, reconexion, inicio, ready, jugar, pausa, estrella, retry y desconexion  
**CUANDO** se revisa el mapa de casos de uso y sus consumidores migrados  
**ENTONCES** cada flujo tiene una familia responsable identificable; sala cubre crear, unirse, abandonar, expulsar y resync, reconexion cubre el rejoin por identidad existente, y estrella cubre proponer, aceptar, cancelar, rechazar y cerrar su animacion cuando aplique.  
**Validacion:** matriz caso de uso--comando/callback contra los handlers existentes y pruebas unitarias de cada familia.

## CA-02 — Orquestacion sin sockets

**DADO** cualquier caso de uso de la capa de aplicacion  
**CUANDO** se invoca desde una prueba o desde un handler realtime  
**ENTONCES** recibe identidad y datos de comando, nunca un socket, y puede ejecutar la misma decision sin red ni APIs de Socket.IO.  
**Validacion:** pruebas unitarias que instancian los casos con fakes y check automatizado que rechaza imports de Fastify y Socket.IO en `application/`.

## CA-03 — Resultados tipados y efectos completos

**DADO** una solicitud aceptada o rechazada de cualquiera de las familias incluidas  
**CUANDO** el caso de uso termina  
**ENTONCES** devuelve un resultado tipado que distingue el error sin cambios del resultado aceptado con los cambios, eventos y efectos a materializar; el adaptador exterior no recalcula una regla de negocio para completar ese resultado.  
**Validacion:** tests de éxito, rechazo e inmutabilidad por familia, incluidos efectos temporizados y rechazo de callbacks stale.

## CA-04 — Autorizacion y errores preservados

**DADO** las fases, locks, participantes y permisos documentados en `domain.md`  
**CUANDO** una persona intenta iniciar, hacer ready, jugar, pausar, usar estrella o reintentar, o el sistema resuelve una expiracion  
**ENTONCES** se conservan la autorizacion canónica y los mismos errores observables, incluidas las poblaciones distintas de ready, juego, consenso y settlement.  
**Validacion:** tablas deterministas de casos de uso y regresiones Socket.IO para autorizaciones, textos de error, callbacks stale y acciones privadas.

## CA-05 — Sala, reconexion y desconexion conservan identidad y estado

**DADO** una sala de lobby o partida con identidad de jugador estable, presencia, host, mano y posible settlement de estrella pendiente  
**CUANDO** se crea, une, abandona, expulsa, resincroniza, reconecta o desconecta un jugador  
**ENTONCES** se conservan las reglas vigentes de admision, aforo, host, preservacion de mano al desconectar, recuperacion al reconectar, limpieza al abandonar o expulsar y cierre visual de estrella, sin exponer estado privado en broadcasts.  
**Validacion:** fakes de repositorio/eventos para las familias de sala, reconexion y desconexion, más escenarios Socket.IO actuales de privacidad, resync, rejoin, kick y disconnect.

## CA-06 — Frontera realtime y contratos externos sin cambios

**DADO** los parsers, mapas de eventos, acks, snapshots, versiones y logs públicos vigentes  
**CUANDO** un handler migrado recibe un payload válido o inválido  
**ENTONCES** valida el wire, delega en el caso de uso correspondiente y conserva exactamente los contratos públicos, la separación público/privado, el orden funcional de emisiones y el rechazo sin mutación de inputs inválidos.  
**Validacion:** comparación de la suite de integración Socket.IO antes y después de cada familia, incluidos acks, eventos, logs, versiones, snapshots y privacidad.

## CA-07 — Dependencias externas proporcionadas por límites reales

**DADO** un caso de uso que necesita estado de sala, publicación, tiempo, aleatoriedad o trabajo diferido  
**CUANDO** se construye para producción o pruebas  
**ENTONCES** usa los límites necesarios de repositorio, eventos, reloj, random y scheduler, y no crea una interfaz por función ni una abstracción que no represente una dependencia externa real.  
**Validacion:** revisión del mapa de dependencias y tests con fakes deterministas para cada límite utilizado, sin imports desde `application/` hacia implementaciones de `infrastructure/`.

## CA-08 — Dirección de dependencias comprobada

**DADO** las reglas de capas declaradas en `architecture.md`  
**CUANDO** se ejecutan los checks locales del backend  
**ENTONCES** se permite `application -> domain` y sus puertos, se rechazan Fastify, Socket.IO e implementaciones de `infrastructure/` desde `application/`, y se rechaza cualquier arista inversa desde `domain/` hacia `application/`.  
**Validacion:** checker automatizado sobre el árbol real y casos negativos aislados por cada categoría prohibida.

## CA-09 — Migracion por familias con propietario único

**DADO** una familia preparada para migrar  
**CUANDO** se activa su caso de uso  
**ENTONCES** todos sus handlers, callbacks y consumidores relevantes delegan en ese caso de uso, el camino anterior deja de estar activo en el mismo slice y ninguna familia conserva doble decisión o doble escritura.  
**Validacion:** pruebas de caracterización antes/después, búsqueda de símbolos y llamadas antiguas, y revisión por slice de un único propietario activo.

## CA-10 — Reubicacion atómica de la maquina canónica

**DADO** la maquina de estados que hoy es fuente de autorización canónica  
**CUANDO** se normaliza su ubicación física bajo `domain/`  
**ENTONCES** el traslado actualiza en un único slice todos los consumidores, tests, scripts y checks, conserva su autoridad y no mantiene dos rutas activas ni reexports transitorios.  
**Validacion:** compilación, tests de transición y expiración, checker de límites y búsqueda que confirma una única ubicación canónica consumida.

## CA-11 — Pruebas deterministas y descubrimiento recursivo

**DADO** los módulos y tests de aplicación organizados en subdirectorios por familia  
**CUANDO** se ejecutan `test` y `test:coverage` del backend  
**ENTONCES** los tests de subdirectorios se descubren realmente y los casos de uso se prueban con fakes deterministas sin abrir red, usar sockets reales ni depender de reloj, azar o timers del proceso.  
**Validacion:** prueba de descubrimiento que fallaría si un test anidado se omite, ejecución de la suite con fakes y cobertura de los módulos de aplicación modificados cuando sea medible.

## CA-12 — Contexto trazable y restricciones acotadas

**DADO** el mapa final de requisitos, permisos, casos de uso y límites de capas  
**CUANDO** se revisan `domain.md`, `architecture.md` y `AGENTS.md`  
**ENTONCES** `domain.md` relaciona requisitos y permisos con su caso de uso responsable, `architecture.md` define application layer, puertos y dirección de dependencias comprobable, y `AGENTS.md` enlaza el mapa sin duplicar reglas; no se copian estas reglas a agentes SDD genéricos.  
**Validacion:** revisión cruzada contra el código y checks ejecutables, más diff que confirma la ausencia de cambios a agentes SDD genéricos.

# Gaps resueltos

Ninguno. La petición identifica las familias, dependencias, restricciones, compatibilidad exterior y validaciones necesarias; el contexto y la línea base existente precisan los comandos y permisos que cada familia debe preservar sin requerir una decisión funcional adicional.

# Decision humana

Aprobar. La persona usuaria aprueba la propuesta sin solicitar cambios.
