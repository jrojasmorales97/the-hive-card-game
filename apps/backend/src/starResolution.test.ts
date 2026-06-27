import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acknowledgePendingStarResolution,
  createPendingStarResolution,
  isPendingStarResolutionComplete,
} from './starResolution.js';

const discarded = [
  { card: 7, playerId: 'a', playerName: 'Alpha' },
  { card: 12, playerId: 'b', playerName: 'Bravo' },
  { card: 21, playerId: 'c', playerName: 'CPU 1' },
];

test('createPendingStarResolution only waits for connected human sockets that were actually discarded', () => {
  const pending = createPendingStarResolution(discarded, {
    a: { id: 'a', connected: true, socketId: 'socket-a' },
    b: { id: 'b', connected: false, socketId: null },
    c: { id: 'c', connected: true, socketId: null, isCpu: true },
  });

  assert.deepEqual([...pending.awaitingPlayerIds], ['a']);
  assert.equal(isPendingStarResolutionComplete(pending), false);
});

test('acknowledgePendingStarResolution completes when the last awaited player confirms', () => {
  const pending = createPendingStarResolution(discarded, {
    a: { id: 'a', connected: true, socketId: 'socket-a' },
    b: { id: 'b', connected: true, socketId: 'socket-b' },
    c: { id: 'c', connected: true, socketId: null, isCpu: true },
  });

  const afterFirstAck = acknowledgePendingStarResolution(pending, 'a');
  assert.equal(isPendingStarResolutionComplete(afterFirstAck), false);

  const afterSecondAck = acknowledgePendingStarResolution(afterFirstAck, 'b');
  assert.equal(isPendingStarResolutionComplete(afterSecondAck), true);
});

test('acknowledgePendingStarResolution ignores duplicate or irrelevant confirmations', () => {
  const pending = createPendingStarResolution(discarded, {
    a: { id: 'a', connected: true, socketId: 'socket-a' },
    b: { id: 'b', connected: true, socketId: 'socket-b' },
    c: { id: 'c', connected: true, socketId: null, isCpu: true },
  });

  const afterIrrelevantAck = acknowledgePendingStarResolution(pending, 'missing');
  assert.equal(afterIrrelevantAck, pending);

  const afterAck = acknowledgePendingStarResolution(pending, 'a');
  const afterDuplicate = acknowledgePendingStarResolution(afterAck, 'a');
  assert.equal(afterDuplicate, afterAck);
});
