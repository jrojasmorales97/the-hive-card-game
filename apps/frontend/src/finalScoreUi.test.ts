import test from 'node:test';
import assert from 'node:assert/strict';

import { podiumToneForRank, shouldUseTwoColumnFinalScoreLayout, timingFeedbackForBand } from './finalScoreUi.js';

test('shouldUseTwoColumnFinalScoreLayout only switches after six players', () => {
  assert.equal(shouldUseTwoColumnFinalScoreLayout(6), false);
  assert.equal(shouldUseTwoColumnFinalScoreLayout(7), true);
});

test('podiumToneForRank classifies only the top three podium positions', () => {
  assert.equal(podiumToneForRank(0), 'gold');
  assert.equal(podiumToneForRank(1), 'silver');
  assert.equal(podiumToneForRank(2), 'bronze');
  assert.equal(podiumToneForRank(3), 'none');
});

test('timingFeedbackForBand reduces detailed timing bands to final score labels', () => {
  assert.equal(timingFeedbackForBand('sync'), 'ONTIME');
  assert.equal(timingFeedbackForBand('unrated'), 'ONTIME');
  assert.equal(timingFeedbackForBand('slightly-fast'), 'FAST');
  assert.equal(timingFeedbackForBand('very-fast'), 'FAST');
  assert.equal(timingFeedbackForBand('slightly-slow'), 'SLOW');
  assert.equal(timingFeedbackForBand('very-slow'), 'SLOW');
});
