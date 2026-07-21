import assert from 'node:assert/strict';
import test from 'node:test';

import { expireRoundEffect, pauseRound, setRoundReady } from './round.js';
import type { DomainMatch } from './model.js';

function match(): DomainMatch {
  return {
    status: 'in-game', hostId: 'alpha',
    players: {
      alpha: { id: 'alpha', name: 'Alpha', connected: true, ready: false, hand: [9] },
      beta: { id: 'beta', name: 'Beta', connected: true, ready: false, hand: [4] },
      empty: { id: 'empty', name: 'Empty', connected: true, ready: false, hand: [] },
      cpu: { id: 'cpu', name: 'CPU', connected: true, ready: false, hand: [7], isCpu: true },
    },
    game: {
      phase: 'focus', currentLevel: 1, maxLevel: 12, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
      rewardMap: {}, mode: 'dev-cpu', starProposal: null, interactionLock: null, startedAt: 0, errorCounts: {}, finalResults: null,
    },
  };
}

test('ready ignores empty hands, synchronizes CPU, and starts one canonical countdown', () => {
  const first = setRoundReady(match(), 'alpha', true, { now: 100, countdownMs: 3_000 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.state.players.cpu.ready, true);
  assert.equal(first.effects.length, 0);
  const second = setRoundReady(first.state, 'beta', true, { now: 120, countdownMs: 3_000 });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.deepEqual(second.effects, [{ type: 'schedule', trigger: 'countdown-expired', dueAt: 3_120, expected: { phase: 'focus', lockReason: 'countdown', lockUntil: 3_120 } }]);
  assert.deepEqual(setRoundReady(second.state, 'empty', true, { now: 121, countdownMs: 3_000 }), { ok: false, error: 'The countdown is already running' });
});

test('pause clears only active players and returns the declared pause event', () => {
  const source = match();
  source.game!.phase = 'playing';
  source.players.alpha.ready = true;
  source.players.empty.ready = true;
  const result = pauseRound(source, 'alpha', 10);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.game?.phase, 'paused');
  assert.equal(result.state.players.alpha.ready, false);
  assert.equal(result.state.players.empty.ready, true);
  assert.equal(result.state.players.cpu.ready, true);
  assert.deepEqual(result.events, [{ type: 'round-paused', playerId: 'alpha' }]);
});

test('expiration rejects stale retries and only transitions the matching countdown once', () => {
  const ready = setRoundReady(match(), 'alpha', true, { now: 0, countdownMs: 10 });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  const countdown = setRoundReady(ready.state, 'beta', true, { now: 1, countdownMs: 10 });
  assert.equal(countdown.ok, true);
  if (!countdown.ok) return;
  const effect = countdown.effects[0]!;
  assert.deepEqual(expireRoundEffect(countdown.state, 'alpha', effect, 10, 10), { ok: false, error: 'Stale timed transition' });
  const resolved = expireRoundEffect(countdown.state, 'alpha', effect, 11, 10);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.state.game?.phase, 'playing');
  assert.equal(resolved.state.game?.interactionLock, null);
  assert.deepEqual(expireRoundEffect(resolved.state, 'alpha', effect, 11, 10), { ok: false, error: 'Stale timed transition' });
});
