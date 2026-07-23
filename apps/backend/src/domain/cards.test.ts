import assert from 'node:assert/strict';
import test from 'node:test';

import { expireCardEffect, nextCpuCard, playCard } from './cards.js';
import type { DomainMatch } from './model.js';

const durations = { errorOverlayMs: 50, roundFlipMs: 5, roundUnflipMs: 7 };

function match(): DomainMatch {
  return {
    status: 'in-game', hostId: 'alpha',
    players: {
      alpha: { id: 'alpha', name: 'Alpha', connected: true, ready: false, hand: [3, 8] },
      beta: { id: 'beta', name: 'Beta', connected: true, ready: false, hand: [2, 5] },
    },
    game: {
      phase: 'playing', currentLevel: 1, maxLevel: 12, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
      rewardMap: {}, mode: 'normal', starProposal: { initiatorId: 'alpha', acceptedBy: ['alpha'] }, interactionLock: null,
      startedAt: 0, errorCounts: {}, finalResults: null,
    },
  };
}

test('cards reject a card owned by another player and a non-minimum own card', () => {
  assert.deepEqual(playCard(match(), 'alpha', 2, 10, durations), { ok: false, error: 'You do not have that card' });
  assert.deepEqual(playCard(match(), 'alpha', 8, 10, durations), { ok: false, error: 'You must play your lowest card first' });
});

test('a correct card is immutable, deterministic, and records the injected timestamp once', () => {
  const source = match();
  source.players.beta.hand = [5];
  const before = structuredClone(source);
  const first = playCard(source, 'alpha', 3, 101, durations);
  const second = playCard(source, 'alpha', 3, 101, durations);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
  if (!first.ok) return;
  assert.deepEqual(first.state.game?.pile, [3]);
  assert.deepEqual(first.state.game?.pileHistory, [{ value: 3, playerId: 'alpha', ts: 101, source: 'manual' }]);
  assert.equal(first.state.game?.starProposal, null);
  assert.deepEqual(first.events, [{ type: 'card-played', playerId: 'alpha', card: 3 }]);
});

test('an error loses one bounded life, counts once, discards all sorted blockers, and declares an error lock', () => {
  const source = match();
  source.players.alpha.hand = [8];
  source.game!.lives = 0;
  const result = playCard(source, 'alpha', 8, 100, durations);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.game?.lives, 0);
  assert.deepEqual(result.state.game?.errorCounts, { alpha: 1 });
  assert.deepEqual(result.state.players.beta.hand, []);
  assert.deepEqual(result.events, [
    { type: 'card-played', playerId: 'alpha', card: 8 },
    { type: 'error-penalty', playerId: 'alpha', card: 8, blockingCards: [{ value: 2, playerId: 'beta' }, { value: 5, playerId: 'beta' }], lifeLost: 1 },
    { type: 'card-discarded', playerId: 'beta', card: 2, reason: 'error' },
    { type: 'card-discarded', playerId: 'beta', card: 5, reason: 'error' },
  ]);
  assert.deepEqual(result.effects, [{ type: 'schedule', trigger: 'error-expired', dueAt: 150, expected: { phase: 'playing', lockReason: 'error', lockUntil: 150 } }]);
});

test('error expiration pauses silently or declares defeat without recalculation in the shell', () => {
  const continuing = match();
  continuing.players.alpha.hand = [8];
  continuing.players.beta.hand = [2, 5, 10];
  const played = playCard(continuing, 'alpha', 8, 0, durations);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  const effect = played.effects[0]!;
  assert.deepEqual(expireCardEffect(played.state, 'alpha', effect, 49, durations), { ok: false, error: 'Stale timed transition' });
  const paused = expireCardEffect(played.state, 'alpha', effect, 50, durations);
  assert.equal(paused.ok, true);
  if (!paused.ok) return;
  assert.equal(paused.state.game?.phase, 'paused');
  assert.deepEqual(paused.events, [{ type: 'card-outcome', outcome: 'pause' }]);

  const defeated = match();
  defeated.players.alpha.hand = [8];
  defeated.game!.lives = 1;
  const failed = playCard(defeated, 'alpha', 8, 0, durations);
  assert.equal(failed.ok, true);
  if (!failed.ok) return;
  const over = expireCardEffect(failed.state, 'alpha', failed.effects[0]!, 50, durations);
  assert.equal(over.ok, true);
  if (!over.ok) return;
  assert.equal(over.state.game?.phase, 'playing');
  assert.deepEqual(over.events, [{ type: 'card-outcome', outcome: 'game-over' }]);
});

test('the last valid card closes the round through expected flip and unflip effects', () => {
  const source = match();
  source.players.alpha.hand = [3];
  source.players.beta.hand = [];
  const played = playCard(source, 'alpha', 3, 10, durations);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  assert.deepEqual(played.effects.map((effect) => effect.trigger), ['round-flip-expired']);
  const flipped = expireCardEffect(played.state, 'alpha', played.effects[0]!, 15, durations);
  assert.equal(flipped.ok, true);
  if (!flipped.ok) return;
  assert.equal(flipped.state.game?.phase, 'round-complete');
  const completed = expireCardEffect(flipped.state, 'alpha', flipped.effects[0]!, 22, durations);
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.state.game?.phase, 'level-complete');
  assert.deepEqual(completed.events, [{ type: 'card-outcome', outcome: 'level-complete' }]);
});

test('CPU selection is a domain decision and rejects inactive, locked, proposed, or human-lowest rounds', () => {
  const source = match();
  source.game!.mode = 'dev-cpu';
  source.game!.starProposal = null;
  source.players.alpha.hand = [4];
  source.players.beta.hand = [2];
  source.players.beta.isCpu = true;
  assert.deepEqual(nextCpuCard(source), { playerId: 'beta', card: 2 });
  source.game!.interactionLock = { reason: 'error', until: 20 };
  assert.equal(nextCpuCard(source), null);
  source.game!.interactionLock = null;
  source.game!.starProposal = { initiatorId: 'alpha', acceptedBy: [] };
  assert.equal(nextCpuCard(source), null);
  source.game!.starProposal = null;
  source.players.alpha.hand = [1];
  assert.equal(nextCpuCard(source), null);
});
