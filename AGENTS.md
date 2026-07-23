# Agent Context Index

## Contexto funcional

- Documento: `.harness/context/domain.md`
- Leer cuando: necesites entender el producto, las reglas del juego, la máquina de estados funcional, los requisitos implementados o pendientes, el glosario funcional o las incertidumbres detectadas a partir de `README.md` y `apps/backend/src/index.ts`.

## Contexto tecnico

- Documento: `.harness/context/architecture.md`
- Leer cuando: vayas a cambiar stack, comandos, estructura de carpetas, contratos Socket.IO, la máquina de estados autoritativa, patrones backend/frontend, dependencias o workflow de despliegue observados en `docker-compose.yml`, `render.yaml`, `apps/backend/` y `apps/frontend/`.
- Contratos Socket.IO: `packages/contracts/`; consultar antes de modificar payloads, snapshots, acks o eventos realtime.
- Capas backend: consulta el mapa de casos de uso, permisos y poblaciones en `.harness/context/domain.md`; `apps/backend/src/application/` orquesta `apps/backend/src/domain/`.

## Artefactos SDD

- Planes: `.harness/plans/`
- Implementaciones: `.harness/implementations/`
- Reviews: `.harness/reviews/`

- Regla: usa `.harness/templates/agents.md`, `.harness/templates/domain.md` y `.harness/templates/architecture.md` como contrato de formato antes de regenerar contexto.
- Regla: si aparecen planes o reviews versionados, usalos como historial cronologico de requerimientos antes de inferir cambios desde el codigo.
- Regla: hoy `.harness/plans/`, `.harness/implementations/` y `.harness/reviews/` solo contienen `.gitkeep`, asi que no hay historial SDD versionado que consultar.

## Skills del proyecto

| Skill | Ruta | Usar cuando |
| --- | --- | --- |
| `ux-ui-design` | `.opencode/skills/ux-ui-design/SKILL.md` | Evaluar jerarquia visual, layout, navegacion, responsive, accesibilidad o consistencia visual antes de cambiar la UI del juego. |
| Ninguno adicional | No aplica | No se observaron skills locales del proyecto en `.agents/skills/` ni `.claude/skills/` durante esta regeneracion. |

## Orden de lectura

1. Lee `README.md` para el flujo principal del producto y los comandos soportados.
2. Lee `.harness/context/domain.md` para reglas de negocio, funcionalidades, requerimientos y glosario.
3. Lee `.harness/context/architecture.md` para stack, estructura, dependencias, comandos y patrones tecnicos.
4. Consulta `apps/backend/src/index.ts` para el contrato realtime y la logica autoritativa actual.
5. Consulta `apps/frontend/src/App.tsx` y los helpers de `apps/frontend/src/` para el comportamiento del cliente.

## Validacion canonica

- `docker compose run --build --rm --no-deps backend npm test`
- `docker compose run --build --rm --no-deps frontend npm test`
- `docker compose run --build --rm --no-deps backend npm run test:coverage`
- `docker compose run --build --rm --no-deps frontend npm run test:coverage`
- `docker compose run --build --rm --no-deps backend npm run build`
- `docker compose run --build --rm --no-deps frontend npm run build`
