import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFinalResults } from './finalScoring.js';

const players = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];

test('scores a player near the pack as well synced', () => {
  const results = calculateFinalResults({
    players,
    plays: [
      { playerId: 'a', value: 10, ts: 1000, source: 'manual' },
      { playerId: 'b', value: 11, ts: 1100, source: 'manual' },
      { playerId: 'c', value: 12, ts: 1080, source: 'manual' },
      { playerId: 'a', value: 30, ts: 3000, source: 'manual' },
      { playerId: 'b', value: 31, ts: 3100, source: 'manual' },
      { playerId: 'c', value: 32, ts: 3050, source: 'manual' },
    ],
    gameStartedAt: 0,
    completedAt: 4000,
    errorCounts: {},
  });

  const alpha = results.find((result) => result.playerId === 'a');
  assert.equal(alpha?.timingBand, 'sync');
  assert.equal(alpha?.direction, 'steady');
  assert.ok((alpha?.score ?? 0) >= 90);
});

test('flags a player who plays much faster than others', () => {
  const results = calculateFinalResults({
    players,
    plays: [
      { playerId: 'a', value: 10, ts: 300, source: 'manual' },
      { playerId: 'b', value: 11, ts: 1400, source: 'manual' },
      { playerId: 'c', value: 12, ts: 1500, source: 'manual' },
      { playerId: 'a', value: 30, ts: 1200, source: 'manual' },
      { playerId: 'b', value: 31, ts: 3000, source: 'manual' },
      { playerId: 'c', value: 32, ts: 3200, source: 'manual' },
    ],
    gameStartedAt: 0,
    completedAt: 4000,
    errorCounts: {},
  });

  const alpha = results.find((result) => result.playerId === 'a');
  assert.equal(alpha?.direction, 'fast');
  assert.ok(['slightly-fast', 'very-fast'].includes(alpha?.timingBand ?? ''));
});

test('flags a player who plays much slower than others', () => {
  const results = calculateFinalResults({
    players,
    plays: [
      { playerId: 'a', value: 10, ts: 1100, source: 'manual' },
      { playerId: 'b', value: 11, ts: 1200, source: 'manual' },
      { playerId: 'c', value: 12, ts: 2400, source: 'manual' },
      { playerId: 'a', value: 30, ts: 2600, source: 'manual' },
      { playerId: 'b', value: 31, ts: 2700, source: 'manual' },
      { playerId: 'c', value: 32, ts: 3900, source: 'manual' },
    ],
    gameStartedAt: 0,
    completedAt: 4200,
    errorCounts: {},
  });

  const charlie = results.find((result) => result.playerId === 'c');
  assert.equal(charlie?.direction, 'slow');
  assert.ok(['slightly-slow', 'very-slow'].includes(charlie?.timingBand ?? ''));
});

test('keeps slight deviations in the positive feedback zone', () => {
  const results = calculateFinalResults({
    players,
    plays: [
      { playerId: 'a', value: 10, ts: 1000, source: 'manual' },
      { playerId: 'b', value: 11, ts: 1050, source: 'manual' },
      { playerId: 'c', value: 12, ts: 1150, source: 'manual' },
      { playerId: 'a', value: 30, ts: 3000, source: 'manual' },
      { playerId: 'b', value: 31, ts: 3090, source: 'manual' },
      { playerId: 'c', value: 32, ts: 3200, source: 'manual' },
    ],
    gameStartedAt: 0,
    completedAt: 4000,
    errorCounts: {},
  });

  const bravo = results.find((result) => result.playerId === 'b');
  assert.equal(bravo?.timingBand, 'sync');
  assert.match(bravo?.summary ?? '', /Good timing/i);
});

test('applies an error penalty to the final score', () => {
  const clean = calculateFinalResults({
    players,
    plays: [
      { playerId: 'a', value: 10, ts: 1000, source: 'manual' },
      { playerId: 'b', value: 11, ts: 1100, source: 'manual' },
      { playerId: 'c', value: 12, ts: 1200, source: 'manual' },
    ],
    gameStartedAt: 0,
    completedAt: 2000,
    errorCounts: {},
  });
  const penalized = calculateFinalResults({
    players,
    plays: [
      { playerId: 'a', value: 10, ts: 1000, source: 'manual' },
      { playerId: 'b', value: 11, ts: 1100, source: 'manual' },
      { playerId: 'c', value: 12, ts: 1200, source: 'manual' },
    ],
    gameStartedAt: 0,
    completedAt: 2000,
    errorCounts: { a: 2 },
  });

  const cleanAlpha = clean.find((result) => result.playerId === 'a');
  const penalizedAlpha = penalized.find((result) => result.playerId === 'a');
  assert.ok((penalizedAlpha?.score ?? 0) < (cleanAlpha?.score ?? 0));
  assert.equal(penalizedAlpha?.errorCount, 2);
  assert.ok((penalizedAlpha?.errorPenalty ?? 0) > 0);
});

test('cpu players are reported as perfectly synced', () => {
  const results = calculateFinalResults({
    players: [
      { id: 'cpu-1', name: 'CPU 1', isCpu: true },
      { id: 'h-1', name: 'Human' },
    ],
    plays: [
      { playerId: 'cpu-1', value: 10, ts: 1000, source: 'manual' },
      { playerId: 'h-1', value: 11, ts: 1200, source: 'manual' },
    ],
    gameStartedAt: 0,
    completedAt: 2000,
    errorCounts: {},
  });

  const cpu = results.find((result) => result.playerId === 'cpu-1');
  assert.equal(cpu?.timingBand, 'sync');
  assert.equal(cpu?.score, 100);
  assert.equal(cpu?.direction, 'steady');
});
