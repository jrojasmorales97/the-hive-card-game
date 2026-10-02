import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryRoomRepository } from '../memory/inMemoryRoomRepository.js';
import { SequenceRandomSource } from '../runtime/sequenceRandomSource.js';
import { CpuRoomAccess, parseCpuRoomCode } from './cpuRoomAccess.js';

test('CPU room access recognizes only supported development codes', () => {
  assert.equal(parseCpuRoomCode('CPUON1'), 1);
  assert.equal(parseCpuRoomCode('CPUON7'), 7);
  assert.equal(parseCpuRoomCode('CPUON8'), null);
  assert.equal(parseCpuRoomCode('cpuon2'), null);
});

test('CPU room access creates an unshareable room once and returns its generated code', () => {
  const rooms = new InMemoryRoomRepository();
  const access = new CpuRoomAccess({ rooms, random: new SequenceRandomSource([0, 0, 0, 0, 0, 0]) });

  const resolved = access.resolveJoinRoom('CPUON2', 'human-001');
  assert.deepEqual(resolved, { roomCode: 'AAAAAA' });
  const room = rooms.get('AAAAAA');
  assert.equal(room?.displayCode, 'CPUON2');
  assert.equal(room?.shareable, false);
  assert.equal(Object.keys(room?.players ?? {}).length, 2);
  assert.deepEqual(access.resolveJoinRoom('AAAAAA', 'other-001'), { error: 'This private room cannot be shared' });
});
