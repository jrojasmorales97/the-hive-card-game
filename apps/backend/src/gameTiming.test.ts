import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEAL_CARD_INTERVAL_MS,
  DEAL_SETTLE_MS,
  ERROR_LOCK_MS,
  LEVEL_COMPLETE_LOCK_MS,
  STAR_RESOLUTION_LOCK_MS,
  applyStarDiscardPreview,
  createInteractionLock,
  discardLowestCardPerPlayer,
  discardLowerCards,
  getDealLockDuration,
  isInteractionLockActive,
  previewLowestCardPerPlayer,
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

test('discardLowerCards removes every lower card across all hands', () => {
  const players = {
    a: { hand: [2, 5, 9] },
    b: { hand: [1, 4, 10] },
    c: { hand: [7, 11] },
  };

  const discarded = discardLowerCards(players, 7);

  assert.equal(discarded, 4);
  assert.deepEqual(players, {
    a: { hand: [9] },
    b: { hand: [10] },
    c: { hand: [7, 11] },
  });
});

test('discardLowestCardPerPlayer removes one lowest card per player and returns sorted preview', () => {
  const players = {
    a: { id: 'a', name: 'Alpha', hand: [9, 2, 5] },
    b: { id: 'b', name: 'Bravo', hand: [8] },
    c: { id: 'c', name: 'Charlie', hand: [] },
    d: { id: 'd', name: 'Delta', hand: [3, 11] },
  };

  const discarded = discardLowestCardPerPlayer(players);

  assert.deepEqual(discarded, [
    { card: 2, playerId: 'a', playerName: 'Alpha' },
    { card: 3, playerId: 'd', playerName: 'Delta' },
    { card: 8, playerId: 'b', playerName: 'Bravo' },
  ]);
  assert.deepEqual(players, {
    a: { id: 'a', name: 'Alpha', hand: [9, 5] },
    b: { id: 'b', name: 'Bravo', hand: [] },
    c: { id: 'c', name: 'Charlie', hand: [] },
    d: { id: 'd', name: 'Delta', hand: [11] },
  });
});

test('previewLowestCardPerPlayer returns the planned star discards without mutating hands', () => {
  const players = {
    a: { id: 'a', name: 'Alpha', hand: [9, 2, 5] },
    b: { id: 'b', name: 'Bravo', hand: [8] },
    c: { id: 'c', name: 'Charlie', hand: [] },
    d: { id: 'd', name: 'Delta', hand: [3, 11] },
  };

  const discarded = previewLowestCardPerPlayer(players);

  assert.deepEqual(discarded, [
    { card: 2, playerId: 'a', playerName: 'Alpha' },
    { card: 3, playerId: 'd', playerName: 'Delta' },
    { card: 8, playerId: 'b', playerName: 'Bravo' },
  ]);
  assert.deepEqual(players, {
    a: { id: 'a', name: 'Alpha', hand: [9, 2, 5] },
    b: { id: 'b', name: 'Bravo', hand: [8] },
    c: { id: 'c', name: 'Charlie', hand: [] },
    d: { id: 'd', name: 'Delta', hand: [3, 11] },
  });
});

test('applyStarDiscardPreview removes only the planned cards after star overlay ends', () => {
  const players = {
    a: { id: 'a', name: 'Alpha', hand: [9, 2, 5] },
    b: { id: 'b', name: 'Bravo', hand: [8] },
    c: { id: 'c', name: 'Charlie', hand: [] },
    d: { id: 'd', name: 'Delta', hand: [3, 11] },
  };

  applyStarDiscardPreview(players, [
    { card: 2, playerId: 'a', playerName: 'Alpha' },
    { card: 3, playerId: 'd', playerName: 'Delta' },
    { card: 8, playerId: 'b', playerName: 'Bravo' },
  ]);

  assert.deepEqual(players, {
    a: { id: 'a', name: 'Alpha', hand: [9, 5] },
    b: { id: 'b', name: 'Bravo', hand: [] },
    c: { id: 'c', name: 'Charlie', hand: [] },
    d: { id: 'd', name: 'Delta', hand: [11] },
  });
});
