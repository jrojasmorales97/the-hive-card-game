import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consensusParticipants,
  hasAllReadyForRound,
  pauseParticipants,
  playParticipants,
  readyParticipants,
  settlementParticipants,
} from './participants.js';

const match = {
  players: [
    { id: 'active', connected: true, ready: true, hand: [12] },
    { id: 'empty', connected: true, ready: false, hand: [] },
    { id: 'offline', connected: false, ready: true, hand: [42] },
  ],
};

test('named participant populations preserve their deliberately different memberships', () => {
  assert.deepEqual(readyParticipants(match).map(({ id }) => id), ['active']);
  assert.deepEqual(playParticipants(match).map(({ id }) => id), ['active']);
  assert.deepEqual(pauseParticipants(match).map(({ id }) => id), ['active']);
  assert.deepEqual(consensusParticipants(match).map(({ id }) => id), ['active', 'empty']);
  assert.deepEqual(settlementParticipants(match).map(({ id }) => id), ['active', 'offline']);
  assert.equal(hasAllReadyForRound(match), true);
});
