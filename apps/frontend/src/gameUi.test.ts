import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countdownValueFromRemaining,
  isCountdownLockActive,
  isHandDealInProgress,
  isInteractionLockActive,
  isReadyLocked,
} from './gameUi.js';

test('interaction lock stays active until its deadline', () => {
  const lock = { reason: 'error' as const, until: 5000 };

  assert.equal(isInteractionLockActive(lock, 4000), true);
  assert.equal(isInteractionLockActive(lock, 5000), false);
});

test('star resolution lock also blocks interaction until its deadline', () => {
  const lock = { reason: 'star' as const, until: 5000 };

  assert.equal(isInteractionLockActive(lock, 4000), true);
  assert.equal(isInteractionLockActive(lock, 5000), false);
});

test('countdown lock only applies to countdown reason', () => {
  assert.equal(isCountdownLockActive({ reason: 'countdown', until: 2000 }, 1000), true);
  assert.equal(isCountdownLockActive({ reason: 'error', until: 2000 }, 1000), false);
});

test('hand dealing remains blocked while server lock is active or local deal is incomplete', () => {
  assert.equal(isHandDealInProgress({ reason: 'dealing', until: 3000 }, 3, 3, 1000), true);
  assert.equal(isHandDealInProgress(null, 3, 2, 1000), true);
  assert.equal(isHandDealInProgress(null, 3, 3, 1000), false);
});

test('ready remains blocked for any active authoritative transition lock', () => {
  assert.equal(isReadyLocked({ reason: 'level-complete', until: 3000 }, 1000), true);
  assert.equal(isReadyLocked({ reason: 'star', until: 3000 }, 1000), true);
  assert.equal(isReadyLocked({ reason: 'countdown', until: 1000 }, 1000), false);
});

test('countdown values match remaining time windows', () => {
  assert.equal(countdownValueFromRemaining(3000), 3);
  assert.equal(countdownValueFromRemaining(1500), 2);
  assert.equal(countdownValueFromRemaining(500), 1);
  assert.equal(countdownValueFromRemaining(0), null);
});
