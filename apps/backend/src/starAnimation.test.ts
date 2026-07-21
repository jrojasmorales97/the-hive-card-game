import assert from 'node:assert/strict';
import test from 'node:test';

import { acknowledgeStarAnimation, createPendingStarAnimation, disconnectStarAnimation, isStarAnimationComplete } from './starAnimation.js';

const effect = { type: 'schedule' as const, trigger: 'star-settled', dueAt: 10, expected: { phase: 'playing' as const, lockReason: 'star' as const, lockUntil: 10 } };
const discarded = [{ card: 2, playerId: 'a', playerName: 'Alpha' }, { card: 3, playerId: 'offline', playerName: 'Offline' }, { card: 4, playerId: 'cpu', playerName: 'CPU' }];

test('animation coordinates only connected human sockets that received an already-decided preview', () => {
  const pending = createPendingStarAnimation(discarded, {
    a: { id: 'a', connected: true, socketId: 'socket-a' },
    offline: { id: 'offline', connected: false, socketId: null },
    cpu: { id: 'cpu', connected: true, socketId: null, isCpu: true },
  }, effect);
  assert.deepEqual([...pending.awaitingPlayerIds], ['a']);
  assert.equal(isStarAnimationComplete(pending), false);
  assert.equal(isStarAnimationComplete(acknowledgeStarAnimation(pending, 'a')), true);
});

test('duplicate, irrelevant acknowledgement and disconnect handling are immutable no-op or completion operations', () => {
  const pending = createPendingStarAnimation(discarded, {
    a: { id: 'a', connected: true, socketId: 'socket-a' }, offline: { id: 'offline', connected: false, socketId: null }, cpu: { id: 'cpu', connected: true, socketId: null, isCpu: true },
  }, effect);
  assert.equal(acknowledgeStarAnimation(pending, 'missing'), pending);
  const disconnected = disconnectStarAnimation(pending, 'a');
  assert.notEqual(disconnected, pending);
  assert.equal(isStarAnimationComplete(disconnected), true);
  assert.equal(acknowledgeStarAnimation(disconnected, 'a'), disconnected);
});
