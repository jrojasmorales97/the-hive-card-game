import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationRoom } from '../../application/model.js';
import { InMemoryRoomRepository } from './inMemoryRoomRepository.js';

function room(code: string, playerIds: string[], version = 0): ApplicationRoom {
  return {
    code, displayCode: code, shareable: true, hostId: playerIds[0] ?? '', status: 'lobby', version, game: null, logs: [],
    players: Object.fromEntries(playerIds.map((id) => [id, { id, name: id, connected: true, ready: false, hand: [] }])),
  };
}

test('repository clones rooms, detects conflicts, and atomically replaces its player index', () => {
  const rooms = new InMemoryRoomRepository();
  const saved = rooms.save(room('ALPHA1', ['host', 'guest']), 0);
  saved.players.host.name = 'Changed copy';

  assert.equal(rooms.get('ALPHA1')?.players.host.name, 'host');
  assert.equal(rooms.findRoomCodeByPlayer('host'), 'ALPHA1');
  assert.equal(rooms.findRoomCodeByPlayer('guest'), 'ALPHA1');
  const firstWrite = rooms.get('ALPHA1')!;
  rooms.save(firstWrite, firstWrite.version);
  assert.throws(() => rooms.save(firstWrite, firstWrite.version), /Room version conflict/);

  const replacement = rooms.get('ALPHA1')!;
  delete replacement.players.guest;
  const next = rooms.save(replacement, replacement.version);
  assert.equal(next.version, 2);
  assert.equal(rooms.findRoomCodeByPlayer('host'), 'ALPHA1');
  assert.equal(rooms.findRoomCodeByPlayer('guest'), undefined);
});

test('repository retains a player moved to another room when replacing or deleting an older room', () => {
  const rooms = new InMemoryRoomRepository();
  rooms.save(room('ALPHA1', ['host', 'guest']), 0);
  rooms.save(room('BRAVO2', ['guest']), 0);

  const first = rooms.get('ALPHA1')!;
  delete first.players.guest;
  rooms.save(first, first.version);
  assert.equal(rooms.findRoomCodeByPlayer('guest'), 'BRAVO2');

  rooms.delete('ALPHA1');
  assert.equal(rooms.findRoomCodeByPlayer('guest'), 'BRAVO2');
  rooms.delete('BRAVO2');
  assert.equal(rooms.findRoomCodeByPlayer('guest'), undefined);
});

test('repository clears both room and player indexes', () => {
  const rooms = new InMemoryRoomRepository();
  rooms.save(room('ALPHA1', ['host']), 0);
  rooms.save(room('BRAVO2', ['guest']), 0);

  rooms.clear();

  assert.equal(rooms.get('ALPHA1'), undefined);
  assert.equal(rooms.get('BRAVO2'), undefined);
  assert.equal(rooms.findRoomCodeByPlayer('host'), undefined);
  assert.equal(rooms.findRoomCodeByPlayer('guest'), undefined);
});
