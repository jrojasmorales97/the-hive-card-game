import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPrivateActions } from './privateState.js';

function actionState(type: string, actions: ReturnType<typeof buildPrivateActions>) {
  return actions.find((action) => action.type === type);
}

function buildContext(overrides: Partial<Parameters<typeof buildPrivateActions>[0]> = {}): Parameters<typeof buildPrivateActions>[0] {
  return {
    roomStatus: 'in-game',
    phase: 'playing',
    isHost: false,
    ready: false,
    handCount: 1,
    connectedPlayerCount: 3,
    canStartGame: false,
    interactionLocked: false,
    interactionLockReason: null,
    stars: 1,
    hasStarProposal: false,
    alreadyAcceptedStar: false,
    isRoundReadyParticipant: true,
    isActiveRoundParticipant: true,
    canParticipateInStarConsensus: true,
    inRoundReadyWindow: false,
    canRetry: false,
    ...overrides,
  };
}

test('buildPrivateActions exposes host start in lobby without showing ready toggles', () => {
  const actions = buildPrivateActions(buildContext({
    roomStatus: 'lobby',
    phase: null,
    isHost: true,
    handCount: 0,
    canStartGame: true,
    isRoundReadyParticipant: false,
    isActiveRoundParticipant: false,
    canParticipateInStarConsensus: false,
  }));

  assert.deepEqual(actionState('ready', actions), { type: 'ready', visible: false, enabled: false });
  assert.deepEqual(actionState('start', actions), { type: 'start', visible: true, enabled: true });
});

test('buildPrivateActions disables lobby start until enough players are connected', () => {
  const actions = buildPrivateActions(buildContext({
    roomStatus: 'lobby',
    phase: null,
    isHost: true,
    handCount: 0,
    connectedPlayerCount: 1,
    canStartGame: false,
    isRoundReadyParticipant: false,
    isActiveRoundParticipant: false,
    canParticipateInStarConsensus: false,
  }));

  assert.deepEqual(actionState('start', actions), {
    type: 'start',
    visible: true,
    enabled: false,
    reason: 'Need at least 2 connected players',
  });
});

test('buildPrivateActions blocks ready and unready during authoritative locks', () => {
  const actions = buildPrivateActions(buildContext({
    phase: 'focus',
    ready: true,
    handCount: 3,
    interactionLocked: true,
    interactionLockReason: 'dealing',
    inRoundReadyWindow: true,
  }));

  assert.deepEqual(actionState('unready', actions), {
    type: 'unready',
    visible: true,
    enabled: false,
    reason: 'Wait until dealing finishes',
  });
});

test('buildPrivateActions hides ready toggles and exposes round-out feedback during paused rounds', () => {
  const actions = buildPrivateActions(buildContext({
    phase: 'paused',
    handCount: 0,
    isRoundReadyParticipant: false,
    isActiveRoundParticipant: false,
    inRoundReadyWindow: true,
  }));

  assert.deepEqual(actionState('ready', actions), { type: 'ready', visible: false, enabled: false });
  assert.deepEqual(actionState('unready', actions), { type: 'unready', visible: false, enabled: false });
  assert.deepEqual(actionState('round_out_wait', actions), {
    type: 'round_out_wait',
    visible: true,
    enabled: false,
    reason: 'The hive is resolving the round without your swarm',
  });
});

test('buildPrivateActions also exposes round-out feedback in focus after an intra-round pause', () => {
  const actions = buildPrivateActions(buildContext({
    phase: 'focus',
    handCount: 0,
    isRoundReadyParticipant: false,
    isActiveRoundParticipant: true,
    inRoundReadyWindow: true,
  }));

  assert.equal(actionState('round_out_wait', actions)?.visible, true);
  assert.equal(actionState('ready', actions)?.visible, false);
  assert.equal(actionState('unready', actions)?.visible, false);
});

test('buildPrivateActions enables play and pause during active play', () => {
  const actions = buildPrivateActions(buildContext({ handCount: 2 }));

  assert.equal(actionState('play_card', actions)?.enabled, true);
  assert.equal(actionState('pause', actions)?.enabled, true);
  assert.equal(actionState('propose_star', actions)?.enabled, true);
});

test('buildPrivateActions keeps star acceptance visible for connected players even without cards', () => {
  const actions = buildPrivateActions(buildContext({
    handCount: 0,
    hasStarProposal: true,
    alreadyAcceptedStar: true,
    isRoundReadyParticipant: false,
    isActiveRoundParticipant: false,
  }));

  assert.deepEqual(actionState('accept_star', actions), {
    type: 'accept_star',
    visible: true,
    enabled: false,
    reason: 'You already accepted the star',
  });
});

test('buildPrivateActions only exposes retry to the host after the run ends', () => {
  const actions = buildPrivateActions(buildContext({
    phase: 'victory',
    isHost: true,
    handCount: 0,
    stars: 0,
    isRoundReadyParticipant: false,
    isActiveRoundParticipant: false,
    canParticipateInStarConsensus: false,
    canRetry: true,
  }));

  assert.deepEqual(actionState('retry', actions), { type: 'retry', visible: true, enabled: true });
});
