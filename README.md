# The Hive

Juego cooperativo de cartas — todos los jugadores deben lanzar sus cartas en orden ascendente sin hablar ni darse señales, desarrollando un sentido del tiempo compartido:

- `apps/backend`: Fastify + Socket.IO (estado autoritativo de sala)
- `apps/frontend`: React + Vite + TypeScript
- `docker-compose.yml`: orquestación de contenedores para desarrollo

## Requisitos

- Docker + Docker Compose

## Levantar el proyecto

```bash
docker compose up --build
```

Servicios:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001/health

## Qué incluye actualmente (Fase 1 + base de Fase 2)

- Crear sala
- Unirse a sala
- Listado de jugadores en tiempo real
- Estado `ready` por jugador
- Inicio de partida (`game:start`) solo si:
  - hay mínimo 2 jugadores
  - la acción la dispara el host
- El inicio es manual; `ready` se usa para reanudar desde foco o pausa entre niveles.
- Setup de nivel inicial según nº de jugadores (vidas, estrellas, nivel máximo)
- Reparto de cartas privadas por jugador
- Juego sin turnos en tiempo real (evento `game:play-card`)
- Validación de "jugar siempre la carta más baja propia"
- Detección de error por cartas menores ocultas + penalización automática de vida
- Descarte automático de cartas menores tras error
- Propuesta y consenso de estrella ninja (`star:propose`, `star:accept`)
- Pausa y reconcentración (`game:pause-request` + `ready` para retomar)
- Progresión de niveles y condición de victoria/derrota
- Reconexión robusta:
  - identidad estable de jugador en cliente (`playerId` persistido)
  - recuperación automática de sala tras reconexión de socket
  - conservación de mano/estado del jugador al desconectar y volver

## Próximas fases

- Modo ciego (juego boca abajo + validación al final del nivel)
- Endurecer reglas avanzadas y añadir tests de motor

## Validación

```bash
docker compose run --build --rm --no-deps backend npm run check:domain
docker compose run --build --rm --no-deps backend npm test
docker compose run --build --rm --no-deps backend npm run test:coverage
docker compose run --build --rm --no-deps backend npm run build
docker compose run --build --rm --no-deps frontend npm test
docker compose run --build --rm --no-deps frontend npm run test:coverage
docker compose run --build --rm --no-deps frontend npm run build
```

`check:domain` verifica que las reglas puras no dependan de transporte, entorno ni timers; los comandos de test y build del backend lo ejecutan automáticamente.
