import test from 'node:test';
import assert from 'node:assert/strict';
import { initialServerState, roomSessionReducer } from './roomSessionReducer.js';

test('roomSessionReducer updates public and private server state together', () => {
  const state = roomSessionReducer(initialServerState(), {
    type: 'snapshot-applied',
    snapshot: {
      version: 1,
      serverTime: 100,
      publicState: { code: 'ABCDE', displayCode: 'ABCDE', shareable: true, status: 'lobby', hostId: 'p1', players: [], game: null, logs: [] },
      privateState: { hand: [3, 8], availableActions: [] },
    },
  });

  assert.equal(state.room?.code, 'ABCDE');
  assert.deepEqual(state.hand, [3, 8]);
});
