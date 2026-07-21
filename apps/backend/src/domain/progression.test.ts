import assert from 'node:assert/strict';
import test from 'node:test';

import { advanceLevel, completeLevel, expireProgressionEffect, finishGame } from './progression.js';
import type { DomainMatch } from './model.js';

function match(): DomainMatch {
  return {
    status: 'in-game', hostId: 'alpha',
    players: {
      alpha: { id: 'alpha', name: 'Alpha', connected: true, ready: false, hand: [] },
      beta: { id: 'beta', name: 'Beta', connected: true, ready: false, hand: [] },
    },
    game: {
      phase: 'level-complete', currentLevel: 2, maxLevel: 4, lives: 5, stars: 3,
      pile: [4], pileHistory: [{ value: 4, playerId: 'alpha', ts: 10, source: 'manual' }], lastPlayed: 4,
      rewardMap: { 2: 'star', 3: 'life' }, mode: 'normal', starProposal: null, interactionLock: null,
      startedAt: 0, errorCounts: { alpha: 1 }, finalResults: null,
    },
  };
}

const deck = Array.from({ length: 100 }, (_, index) => 100 - index);

test('completion is immutable, applies a capped reward once, and declares the exact next-level effect', () => {
  const source = match();
  const before = structuredClone(source);
  const first = completeLevel(source, 'alpha', { now: 100, completedAt: 100 });
  const second = completeLevel(source, 'alpha', { now: 100, completedAt: 100 });
  assert.deepEqual(source, before);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.state.game?.stars, 3);
  assert.deepEqual(first.events, [
    { type: 'level-completed', level: 2, reward: 'star' },
    { type: 'reward-applied', reward: 'star' },
  ]);
  assert.deepEqual(first.effects, [{ type: 'schedule', trigger: 'next-level-expired', dueAt: 100, expected: { phase: 'level-complete', lockReason: null, lockUntil: null } }]);
});

test('advance and ready expiry use the machine and reject stale effects without mutating their input', () => {
  const completed = completeLevel(match(), 'alpha', { now: 100 });
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  const effect = completed.effects[0]!;
  const before = structuredClone(completed.state);
  assert.deepEqual(advanceLevel(completed.state, 'alpha', effect, { now: 99, deck, levelCompleteMs: 50, dealingMs: 20 }), { ok: false, error: 'Stale timed transition' });
  assert.deepEqual(completed.state, before);
  const advanced = advanceLevel(completed.state, 'alpha', effect, { now: 100, deck, levelCompleteMs: 50, dealingMs: 80 });
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  assert.equal(advanced.state.game?.currentLevel, 3);
  assert.equal(advanced.state.game?.phase, 'focus');
  assert.deepEqual(advanced.state.players.alpha.hand, [98, 99, 100]);
  assert.deepEqual(advanced.effects, [{ type: 'schedule', trigger: 'level-ready-expired', dueAt: 180, expected: { phase: 'focus', lockReason: 'level-complete', lockUntil: 180 } }]);
  assert.deepEqual(expireProgressionEffect(advanced.state, 'alpha', advanced.effects[0]!, 179), { ok: false, error: 'Stale timed transition' });
  const ready = expireProgressionEffect(advanced.state, 'alpha', advanced.effects[0]!, 180);
  assert.equal(ready.ok, true);
  if (ready.ok) assert.equal(ready.state.game?.interactionLock, null);
});

test('terminal progression computes current-history scoring for defeat and victory after canonical authorization', () => {
  const defeat = match();
  defeat.game!.phase = 'playing';
  defeat.game!.lives = 0;
  const gameOver = finishGame(defeat, 'alpha', 'game-over', 200);
  assert.equal(gameOver.ok, true);
  if (gameOver.ok) {
    assert.equal(gameOver.state.game?.phase, 'game-over');
    assert.equal(gameOver.state.game?.finalResults?.[0]?.playerId, 'alpha');
    assert.deepEqual(gameOver.events, [{ type: 'game-over' }]);
  }

  const victory = match();
  victory.game!.currentLevel = 4;
  victory.game!.maxLevel = 4;
  victory.game!.rewardMap = { 4: 'life' };
  const completed = completeLevel(victory, 'alpha', { now: 300, completedAt: 300 });
  assert.equal(completed.ok, true);
  if (completed.ok) {
    assert.equal(completed.state.game?.phase, 'victory');
    assert.equal(completed.state.game?.lives, 5);
    assert.deepEqual(completed.events.map((event) => event.type), ['level-completed', 'reward-applied', 'victory']);
  }
  assert.deepEqual(finishGame(match(), 'alpha', 'game-over', 200), { ok: false, error: 'Stale timed transition' });
});
