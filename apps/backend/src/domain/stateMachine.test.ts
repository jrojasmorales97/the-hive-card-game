import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateGameTransition, readyParticipants, consensusParticipants, settlementParticipants, type MachineState } from './stateMachine.js';

function state(overrides: Partial<MachineState> = {}): MachineState {
  return {
    roomStatus: 'in-game',
    phase: 'playing',
    lock: null,
    lives: 2,
    stars: 1,
    hasStarProposal: false,
    starInitiatorId: null,
    acceptedStarBy: [],
    isHost: false,
    actorId: 'alpha',
    players: [
      { id: 'alpha', connected: true, ready: false, hand: [10] },
      { id: 'bravo', connected: true, ready: false, hand: [] },
      { id: 'offline', connected: false, ready: true, hand: [5] },
    ],
    ...overrides,
  };
}

test('state machine inventories independent ready, consensus and settlement populations', () => {
  const snapshot = state({ phase: 'paused' });
  assert.deepEqual(readyParticipants(snapshot).map((player) => player.id), ['alpha']);
  assert.deepEqual(consensusParticipants(snapshot).map((player) => player.id), ['alpha', 'bravo']);
  assert.deepEqual(settlementParticipants(snapshot).map((player) => player.id), ['alpha', 'offline']);
});

test('state machine accepts start and rejects non-host starts without mutating input', () => {
  const snapshot = state({ roomStatus: 'lobby', phase: null, isHost: true });
  const before = structuredClone(snapshot);
  assert.deepEqual(evaluateGameTransition(snapshot, 'start', 100), {
    ok: true,
    patch: { roomStatus: 'in-game', phase: 'focus' },
    effects: [],
  });
  assert.deepEqual(snapshot, before);
  assert.deepEqual(evaluateGameTransition(state({ roomStatus: 'lobby', phase: null }), 'start', 100), {
    ok: false, error: 'Only the host can start the game', patch: {}, effects: [],
  });
});

test('state machine validates play, pause and star actors with baseline errors', () => {
  assert.equal(evaluateGameTransition(state({ card: 10 }), 'play', 10).ok, true);
  assert.deepEqual(evaluateGameTransition(state({ card: 9 }), 'play', 10), {
    ok: false, error: 'You do not have that card', patch: {}, effects: [],
  });
  assert.deepEqual(evaluateGameTransition(state({ actorId: 'bravo' }), 'pause', 10), {
    ok: false, error: 'You already finished your cards this round', patch: {}, effects: [],
  });
  assert.equal(evaluateGameTransition(state({ hasStarProposal: true, starInitiatorId: 'alpha' }), 'cancel-star', 10).ok, true);
  assert.deepEqual(evaluateGameTransition(state({ hasStarProposal: true, starInitiatorId: 'alpha' }), 'reject-star', 10), {
    ok: false, error: 'The proposing player must cancel the star directly', patch: {}, effects: [],
  });
});

test('state machine rejects obsolete temporal callbacks and completes valid countdown', () => {
  const stale = state({ phase: 'focus', lock: { reason: 'countdown', until: 200 } });
  assert.deepEqual(evaluateGameTransition(stale, 'countdown-expired', 100), {
    ok: false, error: 'Stale timed transition', patch: {}, effects: [],
  });
  assert.deepEqual(evaluateGameTransition(stale, 'countdown-expired', 200), {
    ok: true, patch: { phase: 'playing', lock: null }, effects: [],
  });
  assert.equal(evaluateGameTransition(state({ phase: 'victory', isHost: true }), 'retry', 200).ok, true);
});

test('state machine validates each lock-bound temporal release against its original lock', () => {
  assert.equal(evaluateGameTransition(state({ lock: { reason: 'error', until: 20 } }), 'error-expired', 20).ok, true);
  assert.equal(evaluateGameTransition(state({ lock: { reason: 'star', until: 20 } }), 'star-settled', 20).ok, true);
  assert.equal(evaluateGameTransition(state({ phase: 'focus', lock: { reason: 'level-complete', until: 20 } }), 'level-ready-expired', 20).ok, true);
  assert.deepEqual(evaluateGameTransition(state({ lock: { reason: 'star', until: 20 } }), 'error-expired', 20), {
    ok: false, error: 'Stale timed transition', patch: {}, effects: [],
  });
});

test('state machine remains the authority for level and terminal transitions', () => {
  assert.equal(evaluateGameTransition(state({ phase: 'level-complete' }), 'level-completed', 20).ok, true);
  assert.deepEqual(evaluateGameTransition(state({ phase: 'playing' }), 'game-over', 20), {
    ok: true, patch: { phase: 'game-over', lock: null }, effects: [],
  });
  assert.deepEqual(evaluateGameTransition(state({ phase: 'level-complete' }), 'victory', 20), {
    ok: true, patch: { phase: 'victory', lock: null }, effects: [],
  });
});
