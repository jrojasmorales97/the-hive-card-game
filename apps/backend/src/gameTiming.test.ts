import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEAL_CARD_INTERVAL_MS,
  DEAL_SETTLE_MS,
  ERROR_LOCK_MS,
  LEVEL_COMPLETE_LOCK_MS,
  STAR_RESOLUTION_LOCK_MS,
  createInteractionLock,
  getDealLockDuration,
  isInteractionLockActive,
} from './gameTiming.js';

test('createInteractionLock stores reason and deadline', () => {
  const lock = createInteractionLock('countdown', 3600, 1000);

  assert.deepEqual(lock, { reason: 'countdown', until: 4600 });
});

test('createInteractionLock also supports star resolution locks', () => {
  const lock = createInteractionLock('star', STAR_RESOLUTION_LOCK_MS, 500);

  assert.deepEqual(lock, { reason: 'star', until: 500 + STAR_RESOLUTION_LOCK_MS });
});

test('blocking lock constants match the blocking overlay timing plan', () => {
  assert.equal(ERROR_LOCK_MS, 5000);
  assert.equal(STAR_RESOLUTION_LOCK_MS, 5000);
  assert.equal(LEVEL_COMPLETE_LOCK_MS, 5000);
});

test('isInteractionLockActive only returns true before expiration', () => {
  const lock = { reason: 'error' as const, until: 2000 };

  assert.equal(isInteractionLockActive(lock, 1999), true);
  assert.equal(isInteractionLockActive(lock, 2000), false);
  assert.equal(isInteractionLockActive(null, 1500), false);
});

test('getDealLockDuration matches per-card animation cadence', () => {
  assert.equal(getDealLockDuration(0), DEAL_SETTLE_MS);
  assert.equal(getDealLockDuration(3), 3 * DEAL_CARD_INTERVAL_MS + DEAL_SETTLE_MS);
});
