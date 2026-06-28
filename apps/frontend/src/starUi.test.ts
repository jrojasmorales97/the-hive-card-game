import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findMyStarDiscard,
  getStarProposalButtons,
  mergeHandWithStarDiscard,
  starDiscardLaunchDelayMs,
  shouldUseTwoColumnStarDiscardLayout,
  type StarDiscardPreview,
} from './starUi.js';

const discarded: StarDiscardPreview[] = [
  { card: 4, playerId: 'a', playerName: 'Alpha' },
  { card: 9, playerId: 'b', playerName: 'Bravo' },
];

test('findMyStarDiscard returns the discarded card for the current player', () => {
  assert.equal(findMyStarDiscard(discarded, 'b'), 9);
  assert.equal(findMyStarDiscard(discarded, 'missing'), null);
});

test('mergeHandWithStarDiscard restores the pending discarded card only for display', () => {
  assert.deepEqual(mergeHandWithStarDiscard([12, 18], 7), [7, 12, 18]);
  assert.deepEqual(mergeHandWithStarDiscard([7, 12, 18], 7), [7, 12, 18]);
  assert.deepEqual(mergeHandWithStarDiscard([12, 18], null), [12, 18]);
});

test('shouldUseTwoColumnStarDiscardLayout only switches after six discards', () => {
  assert.equal(shouldUseTwoColumnStarDiscardLayout(6), false);
  assert.equal(shouldUseTwoColumnStarDiscardLayout(7), true);
});

test('shouldUseTwoColumnStarDiscardLayout avoids columns when names need more width', () => {
  assert.equal(shouldUseTwoColumnStarDiscardLayout(8, ['Alpha', 'Bravo']), true);
  assert.equal(shouldUseTwoColumnStarDiscardLayout(8, ['A very long player name']), false);
});

test('starDiscardLaunchDelayMs waits until the star overlay finishes before launching discard flight', () => {
  assert.equal(starDiscardLaunchDelayMs(4200, 1000), 3200);
  assert.equal(starDiscardLaunchDelayMs(800, 1000), 0);
  assert.equal(starDiscardLaunchDelayMs(null, 1000), 0);
});

test('getStarProposalButtons only shows propose when there is no active proposal', () => {
  assert.deepEqual(
    getStarProposalButtons({ hasProposal: false, isInitiator: false, canPropose: true, canRespond: false }),
    ['propose'],
  );
  assert.deepEqual(
    getStarProposalButtons({ hasProposal: false, isInitiator: false, canPropose: false, canRespond: false }),
    [],
  );
});

test('getStarProposalButtons gives the proposer a single cancel button', () => {
  assert.deepEqual(
    getStarProposalButtons({ hasProposal: true, isInitiator: true, canPropose: false, canRespond: true }),
    ['cancel'],
  );
});

test('getStarProposalButtons gives other players only accept and reject', () => {
  assert.deepEqual(
    getStarProposalButtons({ hasProposal: true, isInitiator: false, canPropose: false, canRespond: true }),
    ['accept', 'reject'],
  );
  assert.deepEqual(
    getStarProposalButtons({ hasProposal: true, isInitiator: false, canPropose: false, canRespond: false }),
    [],
  );
});
