import test from 'node:test';
import assert from 'node:assert/strict';

import { nextLevelAdvanceDelayMs, nextLevelReadyLockMs } from './levelFlow.js';

test('nextLevelAdvanceDelayMs waits for an active star lock before advancing the level', () => {
  assert.equal(nextLevelAdvanceDelayMs({ reason: 'star', until: 7000 }, 2000), 5000);
  assert.equal(nextLevelAdvanceDelayMs({ reason: 'dealing', until: 7000 }, 2000), 0);
});

test('nextLevelReadyLockMs keeps ready blocked until both level overlay and dealing have completed', () => {
  assert.equal(nextLevelReadyLockMs(5000, 3000), 5000);
  assert.equal(nextLevelReadyLockMs(5000, 5600), 5600);
});
