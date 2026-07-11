import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPrivateActions } from './privateState.js';

function actionState(type: string, actions: ReturnType<typeof buildPrivateActions>) {
  return actions.find((action) => action.type === type);
}

test('buildPrivateActions exposes host start in lobby without showing ready toggles', () => {
  const actions = buildPrivateActions({
    roomStatus: 'lobby',
    phase: null,
    isHost: true,
    ready: false,
    handCount: 0,
    connectedPlayerCount: 2,
    canStartGame: true,
    interactionLocked: false,
    interactionLockReason: null,
    stars: 1,
    hasStarProposal: false,
    alreadyAcceptedStar: false,
    isActiveRoundParticipant: false,
    inRoundReadyWindow: false,
    canRetry: false,
  });

  assert.deepEqual(actionState('ready', actions), { type: 'ready', visible: false, enabled: false });
  assert.deepEqual(actionState('start', actions), { type: 'start', visible: true, enabled: true });
});

test('buildPrivateActions disables lobby start until enough players are connected', () => {
  const actions = buildPrivateActions({
    roomStatus: 'lobby',
    phase: null,
    isHost: true,
    ready: false,
    handCount: 0,
    connectedPlayerCount: 1,
    canStartGame: false,
    interactionLocked: false,
    interactionLockReason: null,
    stars: 1,
    hasStarProposal: false,
    alreadyAcceptedStar: false,
    isActiveRoundParticipant: false,
    inRoundReadyWindow: false,
    canRetry: false,
  });

  assert.deepEqual(actionState('start', actions), {
    type: 'start',
    visible: true,
    enabled: false,
    reason: 'Need at least 2 connected players',
  });
});

test('buildPrivateActions blocks ready and unready during authoritative locks', () => {
  const actions = buildPrivateActions({
    roomStatus: 'in-game',
    phase: 'focus',
    isHost: false,
    ready: true,
    handCount: 3,
    connectedPlayerCount: 3,
    canStartGame: false,
    interactionLocked: true,
    interactionLockReason: 'dealing',
    stars: 1,
    hasStarProposal: false,
    alreadyAcceptedStar: false,
    isActiveRoundParticipant: true,
    inRoundReadyWindow: true,
    canRetry: false,
  });

  assert.deepEqual(actionState('unready', actions), {
    type: 'unready',
    visible: true,
    enabled: false,
    reason: 'Wait until dealing finishes',
  });
});

test('buildPrivateActions enables play and pause during active play', () => {
  const actions = buildPrivateActions({
    roomStatus: 'in-game',
    phase: 'playing',
    isHost: false,
    ready: false,
    handCount: 2,
    connectedPlayerCount: 3,
    canStartGame: false,
    interactionLocked: false,
    interactionLockReason: null,
    stars: 1,
    hasStarProposal: false,
    alreadyAcceptedStar: false,
    isActiveRoundParticipant: true,
    inRoundReadyWindow: false,
    canRetry: false,
  });

  assert.equal(actionState('play_card', actions)?.enabled, true);
  assert.equal(actionState('pause', actions)?.enabled, true);
  assert.equal(actionState('propose_star', actions)?.enabled, true);
});

test('buildPrivateActions keeps star acceptance private to active participant state', () => {
  const actions = buildPrivateActions({
    roomStatus: 'in-game',
    phase: 'playing',
    isHost: false,
    ready: false,
    handCount: 1,
    connectedPlayerCount: 4,
    canStartGame: false,
    interactionLocked: false,
    interactionLockReason: null,
    stars: 1,
    hasStarProposal: true,
    alreadyAcceptedStar: true,
    isActiveRoundParticipant: true,
    inRoundReadyWindow: false,
    canRetry: false,
  });

  assert.deepEqual(actionState('accept_star', actions), {
    type: 'accept_star',
    visible: true,
    enabled: false,
    reason: 'You already accepted the star',
  });
});

test('buildPrivateActions only exposes retry to the host after the run ends', () => {
  const actions = buildPrivateActions({
    roomStatus: 'in-game',
    phase: 'victory',
    isHost: true,
    ready: false,
    handCount: 0,
    connectedPlayerCount: 2,
    canStartGame: false,
    interactionLocked: false,
    interactionLockReason: null,
    stars: 0,
    hasStarProposal: false,
    alreadyAcceptedStar: false,
    isActiveRoundParticipant: false,
    inRoundReadyWindow: false,
    canRetry: true,
  });

  assert.deepEqual(actionState('retry', actions), { type: 'retry', visible: true, enabled: true });
});
