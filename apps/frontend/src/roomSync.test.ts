import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPrivateFragment,
  applyPrivateSnapshot,
  applyPublicFragment,
  createSnapshotCorrelationState,
  estimateServerClockOffset,
  estimateServerNow,
  isExpiredDecorativeWindow,
  shouldApplyDecorativeEvent,
} from './roomSync.js';

test('applyPrivateSnapshot ignores stale versions', () => {
  const initial = createSnapshotCorrelationState<{ room: string }, { hand: number[] }>();
  const { state } = applyPrivateSnapshot(initial, {
    version: 2,
    serverTime: 1000,
    publicState: { room: 'A' },
    privateState: { hand: [1] },
  });

  const stale = applyPrivateSnapshot(state, {
    version: 2,
    serverTime: 1200,
    publicState: { room: 'stale' },
    privateState: { hand: [9] },
  });

  assert.equal(stale.applied, null);
  assert.equal(stale.state.lastAppliedVersion, 2);
});

test('public and private fragments with the same version correlate atomically', () => {
  const initial = createSnapshotCorrelationState<{ room: string }, { hand: number[] }>();
  const pending = applyPublicFragment(initial, {
    version: 4,
    serverTime: 1000,
    publicState: { room: 'A' },
  });

  assert.equal(pending.applied, null);

  const correlated = applyPrivateFragment(pending.state, {
    version: 4,
    serverTime: 1020,
    privateState: { hand: [3, 7] },
  });

  assert.deepEqual(correlated.applied, {
    version: 4,
    serverTime: 1020,
    publicState: { room: 'A' },
    privateState: { hand: [3, 7] },
  });
  assert.equal(correlated.state.lastAppliedVersion, 4);
});

test('mismatched fragment versions do not mix room and hand state', () => {
  const initial = createSnapshotCorrelationState<{ room: string }, { hand: number[] }>();
  const pending = applyPublicFragment(initial, {
    version: 5,
    serverTime: 1000,
    publicState: { room: 'A' },
  });
  const mismatched = applyPrivateFragment(pending.state, {
    version: 6,
    serverTime: 1010,
    privateState: { hand: [8] },
  });

  assert.equal(mismatched.applied, null);
  assert.ok(mismatched.state.pendingPublic[5]);
  assert.ok(mismatched.state.pendingPrivate[6]);
});

test('estimateServerClockOffset uses midpoint when a round-trip sample exists', () => {
  const offset = estimateServerClockOffset({ clientSentAt: 100, clientReceivedAt: 160, serverTime: 120 });

  assert.equal(offset, -10);
  assert.equal(estimateServerNow(offset, 200), 190);
});

test('decorative events only apply for the currently applied version', () => {
  assert.equal(shouldApplyDecorativeEvent(7, 7), true);
  assert.equal(shouldApplyDecorativeEvent(8, 7), true);
  assert.equal(shouldApplyDecorativeEvent(6, 7), false);
  assert.equal(shouldApplyDecorativeEvent(9, 7), false);
  assert.equal(shouldApplyDecorativeEvent(undefined, 7), false);
});

test('expired decorative windows never restart overlays locally', () => {
  assert.equal(isExpiredDecorativeWindow(1000, 25, 980), true);
  assert.equal(isExpiredDecorativeWindow(1100, 25, 980), false);
});
