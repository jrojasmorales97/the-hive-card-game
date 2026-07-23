import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryRoomRepository } from '../infrastructure/memory/inMemoryRoomRepository.js';
import { SequenceRandomSource } from '../infrastructure/runtime/sequenceRandomSource.js';
import { RoomUseCases } from './roomUseCases.js';
import type { ApplicationEvent } from './result.js';

function fixture() {
  const events: ApplicationEvent[] = [];
  const scheduled: string[] = [];
  const rooms = new InMemoryRoomRepository();
  const useCases = new RoomUseCases({ rooms, publisher: { publish: (event) => events.push(event) }, scheduler: { schedule: (_room, key) => scheduled.push(key), cancel: () => undefined, cancelRoom: () => undefined, cancelAll: () => undefined }, random: { next: () => 0 } });
  return { useCases, rooms, events, scheduled };
}

test('room use cases commit once before publishing ordered room events', () => {
  const { useCases, rooms, events } = fixture();
  const created = useCases.createRoom({ playerId: 'host-0001', playerName: 'Host' });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(rooms.get(created.data.room.code)?.version, 0);
  assert.deepEqual(events.map((event) => event.type), ['room-joined']);
  const joined = useCases.joinRoom({ roomCode: created.data.room.code, playerId: 'guest-001', playerName: 'Guest' });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal(joined.data.room.version, 1);
  assert.equal(events.at(-1)?.type, 'room-joined');
});

test('room codes consume the configured random source in stable order', () => {
  const events: ApplicationEvent[] = [];
  const random = new SequenceRandomSource([0, 0.5, 0.999, 0.25, 0.75, 0.125]);
  const useCases = new RoomUseCases({
    rooms: new InMemoryRoomRepository(), publisher: { publish: (event) => events.push(event) },
    scheduler: { schedule: () => undefined, cancel: () => undefined, cancelRoom: () => undefined, cancelAll: () => undefined }, random,
  });

  const created = useCases.createRoom({ playerId: 'host-0001', playerName: 'Host' });

  assert.equal(created.ok, true);
  if (created.ok) assert.equal(created.data.room.code, 'AS9J2E');
  assert.equal(random.reads, 6);
  assert.deepEqual(events.map((event) => event.type), ['room-joined']);
});

test('room use cases preserve reconnection, host migration and empty-room cleanup', () => {
  const { useCases, rooms } = fixture();
  const created = useCases.createRoom({ playerId: 'host-0001', playerName: 'Host' });
  assert.equal(created.ok, true); if (!created.ok) return;
  const code = created.data.room.code;
  assert.equal(useCases.joinRoom({ roomCode: code, playerId: 'guest-001', playerName: 'Guest' }).ok, true);
  const reconnect = useCases.reconnectPlayer({ roomCode: code, playerId: 'guest-001', playerName: 'Guest again' });
  assert.equal(reconnect.ok, true); if (reconnect.ok) assert.equal(reconnect.data.room.players['guest-001'].name, 'Guest again');
  assert.equal(useCases.leaveRoom({ roomCode: code, playerId: 'host-0001' }).ok, true);
  assert.equal(rooms.get(code)?.hostId, 'guest-001');
  const deleted = useCases.leaveRoom({ roomCode: code, playerId: 'guest-001' });
  assert.equal(deleted.ok, true); if (deleted.ok) {
    assert.equal(deleted.data.deleted, true);
    assert.deepEqual(deleted.directives, [{ type: 'cancel-room', roomCode: code }]);
  }
  assert.equal(rooms.get(code), undefined);
});

test('first human joining a private CPU room becomes its host', () => {
  const { useCases, rooms } = fixture();
  rooms.save({
    code: 'CPU001', displayCode: 'CPUON2', shareable: false, hostId: 'cpu-01', status: 'lobby', game: null, version: 0, logs: [],
    players: {
      'cpu-01': { id: 'cpu-01', name: 'CPU 1', connected: true, ready: true, hand: [], isCpu: true },
      'cpu-02': { id: 'cpu-02', name: 'CPU 2', connected: true, ready: true, hand: [], isCpu: true },
    },
  }, 0);

  const joined = useCases.joinRoom({ roomCode: 'CPU001', playerId: 'human-001', playerName: 'Human' });

  assert.equal(joined.ok, true);
  if (joined.ok) assert.equal(joined.data.room.hostId, 'human-001');
});

test('room use cases reject without writes and keep lobby kick permissions', () => {
  const { useCases, rooms } = fixture();
  const missing = useCases.joinRoom({ roomCode: 'MISSING', playerId: 'guest-001', playerName: 'Guest' });
  assert.deepEqual(missing, { ok: false, error: { code: 'not-found', message: 'That room does not exist' } });
  const created = useCases.createRoom({ playerId: 'host-0001', playerName: 'Host' }); assert.equal(created.ok, true); if (!created.ok) return;
  const code = created.data.room.code;
  assert.equal(useCases.joinRoom({ roomCode: code, playerId: 'guest-001', playerName: 'Guest' }).ok, true);
  const before = rooms.get(code);
  const denied = useCases.kickPlayer({ roomCode: code, playerId: 'guest-001', targetPlayerId: 'host-0001' });
  assert.equal(denied.ok, false);
  assert.deepEqual(rooms.get(code), before);
  assert.equal(useCases.kickPlayer({ roomCode: code, playerId: 'host-0001', targetPlayerId: 'guest-001' }).ok, true);
});
