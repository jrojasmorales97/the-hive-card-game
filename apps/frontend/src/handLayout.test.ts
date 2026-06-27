import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHandLayout, buildHandSlotPath } from './handLayout.js';

test('buildHandLayout keeps the current curved queue layout used by high-level four-player hands', () => {
  const layout = buildHandLayout([11, 12, 45, 47, 49, 55, 57, 60], 8);

  assert.equal(layout.primaryCard, 11);
  assert.deepEqual(layout.topRow.map((slot) => slot.card), [12, 45, 47, 49, 55]);
  assert.equal(layout.curveSlot?.card, 57);
  assert.deepEqual(layout.bottomRow.map((slot) => slot.card), [60]);
});

test('buildHandLayout advances the queue exactly like the reference screenshots after consecutive plays', () => {
  const afterEleven = buildHandLayout([12, 45, 47, 49, 55, 57, 60], 8);
  const afterTwelve = buildHandLayout([45, 47, 49, 55, 57, 60], 8);
  const afterFortyFive = buildHandLayout([47, 49, 55, 57, 60], 8);

  assert.equal(afterEleven.primaryCard, 12);
  assert.deepEqual(afterEleven.topRow.map((slot) => slot.card), [45, 47, 49, 55, 57]);
  assert.equal(afterEleven.curveSlot?.card, 60);

  assert.equal(afterTwelve.primaryCard, 45);
  assert.deepEqual(afterTwelve.topRow.map((slot) => slot.card), [47, 49, 55, 57, 60]);
  assert.equal(afterTwelve.curveSlot?.card, null);

  assert.equal(afterFortyFive.primaryCard, 47);
  assert.deepEqual(afterFortyFive.topRow.map((slot) => slot.card), [49, 55, 57, 60, null]);
});

test('buildHandLayout omits the curve when the maximum hand size is lower for larger tables', () => {
  const layout = buildHandLayout([8, 16, 21, 34, 55], 5);

  assert.equal(layout.showCurve, false);
  assert.equal(layout.curveSlot, null);
  assert.deepEqual(layout.topRow.map((slot) => slot.card), [16, 21, 34, 55]);
  assert.deepEqual(layout.bottomRow, []);
});

test('buildHandSlotPath walks through each visible hand position in order', () => {
  const layout = buildHandLayout([11, 12, 45, 47, 49, 55, 57, 60], 8);

  assert.deepEqual(buildHandSlotPath('queue-top-0', 'primary', layout.slotOrder), ['queue-top-0', 'primary']);
  assert.deepEqual(buildHandSlotPath('queue-curve', 'queue-top-4', layout.slotOrder), ['queue-curve', 'queue-top-4']);
  assert.deepEqual(buildHandSlotPath('queue-bottom-0', 'queue-curve', layout.slotOrder), ['queue-bottom-0', 'queue-curve']);
});
