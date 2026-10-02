import Fastify from 'fastify';
import { startServer, stopServer, seedRoomForTests, inspectRoomForTests, deleteRoomForTests } from '../src/index.js';
import { startGame } from '../src/domain/setup.js';
import type { ApplicationRoom } from '../src/application/model.js';

// Separate loopback-only process entrypoint. Production does not expose test controls.
await startServer({ port: 3002, host: '127.0.0.1', timingScale: 0.2 });
const control = Fastify();
control.get('/health', async () => ({ ok: true }));
control.delete<{ Params: { code: string } }>('/rooms/:code', async ({ params }) => { deleteRoomForTests(params.code); return { ok: true }; });
control.get<{ Params: { code: string } }>('/rooms/:code', async (request, reply) => {
  const room = inspectRoomForTests(request.params.code);
  return room ?? reply.code(404).send({ error: 'Room not found' });
});
type Seed = { code: string; hands?: number[][]; cpu?: boolean; phase?: 'playing' | 'focus' | 'paused'; level?: number; maxLevel?: number; lives?: number; stars?: number; lobby?: boolean; disconnected?: number[] };
control.post<{ Body: Seed }>('/rooms', async ({ body }, reply) => {
  if (!/^[A-Z0-9]{6}$/.test(body.code) || !Array.isArray(body.hands) || body.hands.length < 2 || body.hands.length > 8) return reply.code(400).send({ error: 'Invalid fixture' });
  const cards = body.hands.flat();
  if (new Set(cards).size !== cards.length || cards.some(card => !Number.isInteger(card) || card < 1 || card > 100)) return reply.code(400).send({ error: 'Invalid cards' });
  const players = Object.fromEntries(body.hands.map((hand, i) => {
    const id = `${body.code}-player-${i}`;
    return [id, { id, name: i === 0 ? 'Alice' : `Player ${i + 1}`, hand: [...hand].sort((a, b) => a - b), connected: !body.disconnected?.includes(i), ready: false, isCpu: Boolean(body.cpu && i > 0) }];
  }));
  let room: ApplicationRoom = { code: body.code, displayCode: body.code, shareable: true, hostId: Object.keys(players)[0], status: 'lobby', players, game: null, version: 0, logs: [] };
  if (!body.lobby) {
    const started = startGame({ ...room, players: Object.fromEntries(Object.entries(players).map(([id, player]) => [id, { ...player, connected: true }])) }, room.hostId, { now: Date.now(), deck: Array.from({ length: 100 }, (_, i) => i + 1), dealingMs: 0 });
    if (!started.ok) throw new Error(started.error);
    room = { ...room, status: 'in-game', game: { ...started.state.game!, phase: body.phase ?? 'playing', interactionLock: null, currentLevel: body.level ?? 2, maxLevel: body.maxLevel ?? started.state.game!.maxLevel, lives: body.lives ?? 3, stars: body.stars ?? 1 } };
  }
  seedRoomForTests(room);
  return { code: room.code, players: Object.values(players).map(({ id, name }) => ({ id, name })) };
});
await control.listen({ port: 3003, host: '127.0.0.1' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { await control.close(); await stopServer(); process.exit(0); });
