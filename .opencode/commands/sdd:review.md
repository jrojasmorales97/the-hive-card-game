---
description: Muestra y comenta secuencialmente todos los diffs de una implementacion SDD.
agent: sdd-review
---

Usa `$ARGUMENTS` solo para resolver una `implementation` explicita.

Primero resuelve la implementacion objetivo:
- si `$ARGUMENTS` incluye una ruta completa o basename exacto de una `implementation`, usala
- si `$ARGUMENTS` esta vacio, usa la ultima `implementation` generada o citada en el hilo
- acepta solo artefactos de tipo `implementation`
- si el basename es ambiguo, deten la revision y pide precision
- si no puedes resolver una `implementation` del hilo o la ruta no existe, deten la revision
- si `implementation.status` no es `completed`, deten la revision
- si esa implementacion ya tiene una `review`, deten la revision

Tu trabajo es mostrar todos los diffs de la implementacion, archivo por archivo, para facilitar una revision humana informada.

Reglas:
- empieza usando `todowrite` con una tarea por cada archivo cambiado, mas decision humana y artefacto final
- revisa el plan enlazado, la implementation y el codigo afectado
- lee `AGENTS.md`, `.harness/context/domain.md` y `.harness/context/architecture.md` antes de revisar
- si falta ese contexto, pide ejecutar `/sdd:init` antes de continuar
- si falta `.harness/templates/review.md`, deten el comando y explica que el proyecto necesita reinstalar el harness local
- no modifiques codigo fuente
- crea `.harness/reviews/yyyy-MM-dd/<id>-<slug>.md`
- usa `.harness/templates/review.md` como plantilla literal
- reutiliza `id` y `slug` del plan enlazado
- rellena `source_prompt` con el texto original del usuario; si no hubo argumento, usa una frase literal como `inferred from thread context`
- usa `created_by_command: /sdd:review`
- escribe `created_at` en UTC ISO 8601
- `status` del artefacto es siempre `completed`
- resuelve el `baseline` desde la implementation
- construye un inventario exhaustivo y ordenado con todos los archivos anadidos, modificados, renombrados o eliminados por la implementation
- contrasta la lista `Archivos modificados` de la implementation con el diff de Git y no omitas discrepancias
- para cada archivo, muestra el diff completo relativo al baseline; incluye archivos nuevos y eliminados
- para binarios o diffs no representables como texto, indica el cambio y los metadatos disponibles en vez de omitirlo
- presenta los archivos secuencialmente y numerados en un orden estable
- identifica el rango principal de lineas del cambio como `<ruta>:<inicio>-<fin>`; si hay varios hunks, muestra todos los rangos
- despues de cada diff escribe un comentario breve en este orden:
  1. `Descripcion`: que estamos viendo y que responsabilidad tiene el cambio
  2. `Decision`: por que se ha hecho asi, usando el plan y la implementation como evidencia
  3. `Legibilidad`: si respeta las reglas de `.harness/context/architecture.md` o que norma concreta viola
- usa exactamente este formato por archivo:

  ````md
  ## <numero>. `<ruta>:<rangos>`

  ```diff
  <diff completo del archivo>
  ```

  - Descripcion: <que estamos viendo>
  - Decision: <por que se hizo este cambio>
  - Legibilidad: <norma respetada o violada>
  ````

- la critica de legibilidad debe ser concreta y citar la norma aplicable; si no hay violacion, escribe `Sin incumplimientos observados`
- no busques mejoras fuera del diff ni conviertas preferencias personales en problemas
- no crees planes, TODOs correctivos ni nuevas implementaciones
- si falta contexto para juzgar algo material, usa `question` en un lote pequeno centrado en ese unico topic
- muestra todos los bloques de diff y comentarios en el hilo principal antes de pedir una decision
- cuando todos los archivos se hayan mostrado y comentado, pide una decision humana con `question`: `Aprobar` o `Solicitar cambios`
- escribe el artefacto de review despues de recibir esa decision para registrar el valor elegido en `decision`
- si la review se crea correctamente, actualiza solo `plan.status` a `reviewed`
- usa `Ninguno` o `No aplica` cuando corresponda

Antes de cerrar:
- el mensaje final al hilo principal debe empezar exactamente con `ARTEFACT_PATH: <ruta>`
- en la segunda linea indica `ARTEFACT_TYPE: review`
- en la tercera linea indica `IMPLEMENTATION_PATH: <ruta-de-la-implementation>`
- en la cuarta linea indica `DECISION: <Aprobar|Solicitar cambios>`
- despues usa solo un resumen breve; los diffs ya deben haberse mostrado antes de la decision
