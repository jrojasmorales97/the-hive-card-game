import test from 'node:test';
import assert from 'node:assert/strict';

import { getRoundResolutionOutcome, shouldResolveAfterErrorOverlay } from './roundResolution.js';

test('getRoundResolutionOutcome ends the game when no lives remain', () => {
  assert.equal(getRoundResolutionOutcome(0, 4), 'game-over');
  assert.equal(getRoundResolutionOutcome(-1, 4), 'game-over');
});

test('getRoundResolutionOutcome completes the level when the table is empty and lives remain', () => {
  assert.equal(getRoundResolutionOutcome(2, 0), 'level-complete');
});

test('getRoundResolutionOutcome pauses the round when the game can continue', () => {
  assert.equal(getRoundResolutionOutcome(2, 3), 'pause');
});

test('shouldResolveAfterErrorOverlay only defers terminal and level-end outcomes', () => {
  assert.equal(shouldResolveAfterErrorOverlay('game-over'), true);
  assert.equal(shouldResolveAfterErrorOverlay('level-complete'), true);
  assert.equal(shouldResolveAfterErrorOverlay('pause'), false);
});
