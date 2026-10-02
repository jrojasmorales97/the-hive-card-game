import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPrivateFragment,
  applyPrivateSnapshot,
  applyPublicFragment,
  createSnapshotCorrelationState,
} from '../../roomSync.js';

test('correlated room fragments are applied without reprocessing their version', () => {
  const publicState = { code: 'ABCDE', displayCode: 'ABCDE', shareable: true, status: 'in-game' as const, hostId: 'p1', players: [], game: null, logs: [] };
  const privateState = { hand: [3, 8], availableActions: [] };
  const publicResult = applyPublicFragment(createSnapshotCorrelationState<typeof publicState, typeof privateState>(), {
    version: 2,
    serverTime: 200,
    publicState,
  });
  const privateResult = applyPrivateFragment(publicResult.state, {
    version: 2,
    serverTime: 200,
    privateState,
  });

  assert.equal(privateResult.applied?.publicState.status, 'in-game');
  assert.equal(applyPrivateSnapshot(privateResult.state, privateResult.applied!).applied, null);
});
