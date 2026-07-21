import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateFinalResults } from './scoring.js';

const players = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }, { id: 'c', name: 'Charlie' }];

test('scoring preserves deterministic timing bands, messages, and stable ranking', () => {
  const input = {
    players,
    plays: [
      { playerId: 'a', value: 10, ts: 1000, source: 'manual' as const },
      { playerId: 'b', value: 11, ts: 1100, source: 'manual' as const },
      { playerId: 'c', value: 12, ts: 1080, source: 'manual' as const },
      { playerId: 'a', value: 30, ts: 3000, source: 'manual' as const },
      { playerId: 'b', value: 31, ts: 3100, source: 'manual' as const },
      { playerId: 'c', value: 32, ts: 3050, source: 'star' as const },
    ], gameStartedAt: 0, completedAt: 4000, errorCounts: {},
  };
  const first = calculateFinalResults(input);
  assert.deepEqual(first, calculateFinalResults(input));
  assert.equal(first.find((result) => result.playerId === 'a')?.timingBand, 'sync');
  assert.match(first.find((result) => result.playerId === 'a')?.summary ?? '', /Good timing/);
  assert.deepEqual(first, [...first].sort((left, right) => right.score - left.score || left.avgDeviationMs - right.avgDeviationMs || left.playerName.localeCompare(right.playerName)));
});

test('scoring retains fast, slow, CPU, unrated, and capped-error behavior', () => {
  const results = calculateFinalResults({
    players: [...players, { id: 'cpu', name: 'CPU', isCpu: true }, { id: 'none', name: 'Nobody' }],
    plays: [
      { playerId: 'a', value: 1, ts: 100, source: 'manual' },
      { playerId: 'b', value: 2, ts: 2500, source: 'manual' },
      { playerId: 'c', value: 3, ts: 2900, source: 'manual' },
      { playerId: 'a', value: 4, ts: 400, source: 'manual' },
      { playerId: 'b', value: 5, ts: 3500, source: 'manual' },
      { playerId: 'c', value: 6, ts: 3900, source: 'manual' },
    ], gameStartedAt: 0, completedAt: 4000, errorCounts: { none: 9 },
  });
  assert.equal(results.find((result) => result.playerId === 'a')?.direction, 'fast');
  assert.equal(results.find((result) => result.playerId === 'c')?.direction, 'slow');
  assert.deepEqual(results.find((result) => result.playerId === 'cpu'), {
    playerId: 'cpu', playerName: 'CPU', score: 100, timingBand: 'sync', direction: 'steady', avgDeviationMs: 0,
    errorPenalty: 0, errorCount: 0, summary: 'Good timing. Stay the course.', roast: 'CPU is a cold-blooded metronome. Of course the robot nailed it.',
  });
  const unrated = results.find((result) => result.playerId === 'none');
  assert.equal(unrated?.timingBand, 'unrated');
  assert.equal(unrated?.errorPenalty, 36);
  assert.equal(unrated?.score, 36);
});
