import test from 'node:test';
import assert from 'node:assert/strict';

import { levelCompleteOverlayDelayMs } from './levelFlow.js';

test('levelCompleteOverlayDelayMs waits for pile clear animation when no overlay is blocking', () => {
  assert.equal(levelCompleteOverlayDelayMs({ currentPileCount: 3, previousPileCount: 2, blockingUntil: null, now: 1000 }), 1076);
});

test('levelCompleteOverlayDelayMs waits for the active blocking overlay when star resolves first', () => {
  assert.equal(levelCompleteOverlayDelayMs({ currentPileCount: 0, previousPileCount: 0, blockingUntil: 4200, now: 1000 }), 3200);
});
