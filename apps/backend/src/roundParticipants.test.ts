import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRoundReadyRequest,
  createPauseEventPayload,
  getConnectedConsensusParticipants,
  hasAllReadyForRound,
  isActiveRoundParticipant,
  isConsensusParticipant,
  isPauseParticipant,
  isPlayParticipant,
  isReadyParticipant,
  isStarSettlementParticipant,
  isRoundReadyParticipant,
  PAUSE_READY_MESSAGE,
  pauseRoundForReady,
  validateRoundReadyRequest,
  type RoundReadyPhase,
  type RoundReadyRoom,
} from './roundParticipants.js';

function buildRoom(players: RoundReadyRoom['players'], phase: RoundReadyPhase = 'playing'): RoundReadyRoom {
  return {
    game: { phase },
    players,
  };
}

test('hasAllReadyForRound only counts connected players who still have cards during paused rounds', () => {
  const room = buildRoom({
    active: { connected: true, hand: [11], ready: true },
    waiting: { connected: true, hand: [], ready: false },
    offline: { connected: false, hand: [19], ready: false },
  }, 'paused');

  assert.equal(hasAllReadyForRound(room), true);
});

test('pauseRoundForReady only resets active round participants on manual pauses', () => {
  const room = buildRoom({
    alpha: { connected: true, hand: [12], ready: true },
    bravo: { connected: true, hand: [], ready: true },
    cpu: { connected: true, hand: [33], ready: true },
  });

  assert.equal(pauseRoundForReady(room), true);
  assert.equal(room.game?.phase, 'paused');
  assert.equal(room.players.alpha.ready, false);
  assert.equal(room.players.cpu.ready, false);
  assert.equal(room.players.bravo.ready, true);
});

test('pauseRoundForReady keeps emptied players out of the ready loop after an error discard', () => {
  const room = buildRoom({
    striker: { connected: true, hand: [42], ready: true },
    cleared: { connected: true, hand: [], ready: false },
    closer: { connected: true, hand: [88], ready: true },
  });

  pauseRoundForReady(room);
  room.players.striker.ready = true;
  room.players.closer.ready = true;

  assert.equal(hasAllReadyForRound(room), true);
});

test('pauseRoundForReady keeps star-resolved empty players from blocking the next countdown', () => {
  const room = buildRoom({
    alpha: { connected: true, hand: [], ready: false },
    beta: { connected: true, hand: [54], ready: false },
  });

  pauseRoundForReady(room);
  room.players.beta.ready = true;

  assert.equal(hasAllReadyForRound(room), true);
});

test('isActiveRoundParticipant lets empty-handed players stay visible outside playing or paused phases', () => {
  const room = buildRoom({
    alpha: { connected: true, hand: [], ready: false },
  }, 'focus');

  assert.equal(isActiveRoundParticipant(room, room.players.alpha), true);
});

test('isRoundReadyParticipant keeps empty-handed players out of the ready loop during paused and focus', () => {
  const pausedRoom = buildRoom({
    alpha: { connected: true, hand: [], ready: false },
  }, 'paused');
  const focusRoom = buildRoom({
    alpha: { connected: true, hand: [], ready: false },
  }, 'focus');

  assert.equal(isRoundReadyParticipant(pausedRoom, pausedRoom.players.alpha), false);
  assert.equal(isRoundReadyParticipant(focusRoom, focusRoom.players.alpha), false);
});

test('getConnectedConsensusParticipants keeps connected empty-handed players in consensus flows', () => {
  const room = buildRoom({
    empty: { connected: true, hand: [], ready: false },
    active: { connected: true, hand: [12], ready: true },
    offline: { connected: false, hand: [42], ready: false },
  }, 'playing');

  assert.deepEqual(
    getConnectedConsensusParticipants(room).map((player) => player.hand.length),
    [0, 1],
  );
});

test('validateRoundReadyRequest rejects empty-handed players throughout paused to focus resume', () => {
  const room = buildRoom({
    empty: { connected: true, hand: [], ready: false },
    active: { connected: true, hand: [12], ready: false },
  }, 'paused');

  assert.deepEqual(validateRoundReadyRequest(room, room.players.empty), {
    ok: false,
    error: "You are not part of this round's ready-up",
  });
  assert.deepEqual(validateRoundReadyRequest(room, room.players.active), { ok: true });

  room.players.active.ready = true;
  assert.equal(hasAllReadyForRound(room), true);

  if (room.game) room.game.phase = 'focus';
  assert.deepEqual(validateRoundReadyRequest(room, room.players.empty), {
    ok: false,
    error: "You are not part of this round's ready-up",
  });
  assert.equal(room.players.empty.ready, false);
});

test('applyRoundReadyRequest enforces eligibility and starts countdown for the real ready quorum', () => {
  const room = buildRoom({
    empty: { connected: true, hand: [], ready: false },
    active: { connected: true, hand: [12], ready: false },
    cpu: { connected: true, hand: [44], ready: false },
  }, 'paused');

  assert.deepEqual(applyRoundReadyRequest(room, room.players.empty, true), {
    ok: false,
    error: "You are not part of this round's ready-up",
  });
  assert.equal(room.players.empty.ready, false);

  const result = applyRoundReadyRequest(room, room.players.active, true, () => {
    room.players.cpu.ready = true;
  });
  assert.deepEqual(result, { ok: true, shouldBeginCountdown: true });

  if (room.game) room.game.phase = 'focus';
  assert.equal(applyRoundReadyRequest(room, room.players.empty, true).ok, false);
  assert.equal(room.players.empty.ready, false);
});

test('pause message states that only players carrying cards must ready up', () => {
  assert.equal(PAUSE_READY_MESSAGE, 'Pause requested. The hive waits only for players still carrying cards.');
  assert.doesNotMatch(PAUSE_READY_MESSAGE, /everyone/i);
  assert.deepEqual(createPauseEventPayload(17, 'player-1'), {
    version: 17,
    by: 'player-1',
    message: PAUSE_READY_MESSAGE,
  });
});

test('named eligibility policies keep ready, play, pause, consensus and settlement distinct', () => {
  const room = buildRoom({
    active: { connected: true, hand: [12], ready: false },
    empty: { connected: true, hand: [], ready: false },
    offline: { connected: false, hand: [42], ready: false },
  }, 'paused');
  assert.equal(isReadyParticipant(room, room.players.active), true);
  assert.equal(isReadyParticipant(room, room.players.empty), false);
  assert.equal(isPlayParticipant(room, room.players.active), true);
  assert.equal(isPauseParticipant(room, room.players.empty), false);
  assert.equal(isConsensusParticipant(room.players.empty), true);
  assert.equal(isConsensusParticipant(room.players.offline), false);
  assert.equal(isStarSettlementParticipant(room.players.empty), false);
  assert.equal(isStarSettlementParticipant(room.players.offline), true);
});
