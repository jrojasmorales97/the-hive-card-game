import assert from 'node:assert/strict';
import test from 'node:test';

import type { MachineState } from '../domain/stateMachine.js';
import { playerCapabilities } from './playerView.js';

function state(overrides: Partial<MachineState> = {}): MachineState {
  return {
    roomStatus: 'in-game', phase: 'focus', lock: null, lives: 2, stars: 1, hasStarProposal: false,
    starInitiatorId: null, acceptedStarBy: [], isHost: false, actorId: 'host',
    players: [
      { id: 'host', connected: true, ready: false, hand: [8] },
      { id: 'guest', connected: true, ready: false, hand: [4] },
      { id: 'empty', connected: true, ready: false, hand: [] },
    ],
    ...overrides,
  };
}

test('private capabilities use the state machine for ready and pause populations with an injected clock', () => {
  assert.deepEqual(playerCapabilities(state(), 100), {
    canStart: false, canRetry: false, canReady: true, canPlay: false, canPause: false,
  });
  assert.equal(playerCapabilities(state({ actorId: 'empty' }), 100).canReady, false);
  assert.equal(playerCapabilities(state({ phase: 'playing' }), 100).canPause, true);
  assert.equal(playerCapabilities(state({ phase: 'playing', actorId: 'empty' }), 100).canPause, false);
  assert.equal(playerCapabilities(state({ phase: 'playing', lock: { reason: 'countdown', until: 101 } }), 100).canPause, false);
  assert.equal(playerCapabilities(state({ phase: 'playing', lock: { reason: 'countdown', until: 100 } }), 100).canPause, true);
});
