import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCommandActions, gameplayControlDisabled } from './commandActions.js';

test('gameplayControlDisabled blocks an enabled control whenever a message overlay is visible', () => {
  assert.equal(gameplayControlDisabled(true, false), false);
  assert.equal(gameplayControlDisabled(true, true), true);
  assert.equal(gameplayControlDisabled(false, false), true);
  assert.equal(gameplayControlDisabled(undefined, false), true);
});

test('buildCommandActions maps round-out private actions to a disabled hive placeholder', () => {
  const actions = buildCommandActions({
    roundOutWaitAction: {
      type: 'round_out_wait',
      visible: true,
      enabled: false,
      reason: 'Waiting for others',
    },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isPlaying: false,
    interactionBlocked: false,
    isInGame: true,
    phase: 'paused',
  });

  assert.deepEqual(actions, [
    {
      key: 'hive-sync',
      label: 'Waiting for others',
      icon: 'hive',
      className: 'command-button secondary prep-placeholder',
      disabled: true,
    },
  ]);
});

test('buildCommandActions keeps waiting CTA for active players that already readied', () => {
  const actions = buildCommandActions({
    unreadyAction: {
      type: 'unready',
      visible: true,
      enabled: true,
    },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isPlaying: false,
    interactionBlocked: false,
    isInGame: true,
    phase: 'paused',
  });

  assert.equal(actions[0]?.key, 'waiting');
  assert.equal(actions[0]?.disabled, false);
});

test('buildCommandActions keeps ready visible for active players and respects overlay locks', () => {
  const actions = buildCommandActions({
    readyAction: {
      type: 'ready',
      visible: true,
      enabled: true,
    },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: true,
    isPlaying: false,
    interactionBlocked: false,
    isInGame: true,
    phase: 'focus',
  });

  assert.deepEqual(actions, [
    {
      key: 'ready',
      label: 'Ready',
      icon: 'task_alt',
      className: 'command-button pulse',
      disabled: true,
    },
  ]);
});

test('buildCommandActions maps start and waiting commands from private capabilities', () => {
  const startActions = buildCommandActions({
    startAction: { type: 'start', visible: true, enabled: true },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isInGame: false,
    phase: null,
  });
  const waitingActions = buildCommandActions({
    unreadyAction: { type: 'unready', visible: true, enabled: true },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isInGame: true,
    phase: 'focus',
  });
  const preparingActions = buildCommandActions({
    unreadyAction: { type: 'unready', visible: true, enabled: true },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: true,
    placeholderLabel: 'The hive is dealing the next pulse',
    gameplayOverlayBlocked: false,
    isInGame: true,
    phase: 'focus',
  });

  assert.equal(startActions[0]?.key, 'start');
  assert.equal(startActions[0]?.disabled, false);
  assert.equal(waitingActions[0]?.key, 'waiting');
  assert.equal(waitingActions[0]?.disabled, false);
  assert.equal(preparingActions[0]?.key, 'hive-sync');
  assert.equal(preparingActions[0]?.disabled, true);
});

test('buildCommandActions keeps star consensus CTAs ahead of the round-out placeholder', () => {
  const actions = buildCommandActions({
    roundOutWaitAction: {
      type: 'round_out_wait',
      visible: true,
      enabled: false,
      reason: 'Waiting for others',
    },
    acceptStarAction: {
      type: 'accept_star',
      visible: true,
      enabled: true,
    },
    rejectStarAction: {
      type: 'reject_star',
      visible: true,
      enabled: true,
    },
    showCancelStar: false,
    showAcceptStar: true,
    showRejectStar: true,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isPlaying: true,
    interactionBlocked: false,
    isInGame: true,
    phase: 'playing',
  });

  assert.deepEqual(actions, [
    {
      key: 'accept-star',
      label: 'Accept star',
      icon: 'handshake',
      className: 'command-button pulse',
      disabled: false,
    },
    {
      key: 'reject-star',
      label: 'Reject star',
      icon: 'close',
      className: 'command-button secondary',
      disabled: false,
    },
  ]);
});

test('buildCommandActions derives cancel and reject disabled states from private capabilities', () => {
  const cancelActions = buildCommandActions({
    cancelStarAction: { type: 'cancel_star', visible: true, enabled: false },
    showCancelStar: true,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isInGame: true,
    phase: 'playing',
  });
  const rejectActions = buildCommandActions({
    rejectStarAction: { type: 'reject_star', visible: true, enabled: false },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: true,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isInGame: true,
    phase: 'playing',
  });

  assert.equal(cancelActions[0]?.key, 'cancel-star');
  assert.equal(cancelActions[0]?.disabled, true);
  assert.equal(rejectActions[0]?.key, 'reject-star');
  assert.equal(rejectActions[0]?.disabled, true);
});

test('buildCommandActions preserves gameplay CTAs before fallback placeholders', () => {
  const actions = buildCommandActions({
    pauseAction: {
      type: 'pause',
      visible: true,
      enabled: true,
    },
    proposeStarAction: {
      type: 'propose_star',
      visible: true,
      enabled: true,
    },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: true,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isPlaying: true,
    interactionBlocked: false,
    isInGame: true,
    phase: 'playing',
  });

  assert.deepEqual(actions, [
    {
      key: 'star',
      label: 'Propose star',
      icon: 'star',
      className: 'command-button star',
      disabled: false,
    },
    {
      key: 'pause',
      label: 'Pause',
      icon: 'pause',
      className: 'command-button secondary',
      disabled: false,
    },
  ]);
});

test('buildCommandActions disables every gameplay command while a message overlay is visible', () => {
  const setupActions = buildCommandActions({
    startAction: { type: 'start', visible: true, enabled: true },
    readyAction: { type: 'ready', visible: true, enabled: true },
    unreadyAction: { type: 'unready', visible: true, enabled: true },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: true,
    isInGame: true,
    phase: 'focus',
  });
  const playingActions = buildCommandActions({
    pauseAction: { type: 'pause', visible: true, enabled: true },
    proposeStarAction: { type: 'propose_star', visible: true, enabled: true },
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: true,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: true,
    isInGame: true,
    phase: 'playing',
  });
  const consensusActions = buildCommandActions({
    cancelStarAction: { type: 'cancel_star', visible: true, enabled: true },
    acceptStarAction: { type: 'accept_star', visible: true, enabled: true },
    rejectStarAction: { type: 'reject_star', visible: true, enabled: true },
    showCancelStar: true,
    showAcceptStar: true,
    showRejectStar: true,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: true,
    isInGame: true,
    phase: 'playing',
  });

  const actions = [...setupActions, ...playingActions, ...consensusActions];
  assert.deepEqual(actions.map((action) => action.key), ['start', 'ready', 'waiting', 'star', 'pause', 'cancel-star', 'accept-star', 'reject-star']);
  assert.ok(actions.every((action) => action.disabled));
});

test('buildCommandActions falls back to layout placeholder during in-game idle states', () => {
  const actions = buildCommandActions({
    showCancelStar: false,
    showAcceptStar: false,
    showRejectStar: false,
    showProposeStar: false,
    showHivePlaceholder: false,
    placeholderLabel: 'The hive is tuning the next pulse',
    gameplayOverlayBlocked: false,
    isPlaying: false,
    interactionBlocked: false,
    isInGame: true,
    phase: 'focus',
  });

  assert.deepEqual(actions, [
    {
      key: 'hive-sync',
      label: 'The hive is tuning the next pulse',
      icon: 'hive',
      className: 'command-button secondary prep-placeholder layout-placeholder',
      disabled: true,
    },
  ]);
});
