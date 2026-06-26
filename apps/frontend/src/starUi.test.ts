import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findMyStarDiscard,
  mergeHandWithStarDiscard,
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
