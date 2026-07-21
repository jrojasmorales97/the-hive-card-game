import assert from 'node:assert/strict';
import test from 'node:test';

import { acceptStar, cancelStar, proposeStar, rejectStar, settleStar } from './star.js';
import type { DomainMatch } from './model.js';

const input = { now: 100, resolutionMs: 50, roundFlipMs: 7 };

function match(): DomainMatch {
  return {
    status: 'in-game', hostId: 'alpha',
    players: {
      alpha: { id: 'alpha', name: 'Alpha', connected: true, ready: false, hand: [9, 2] },
      bravo: { id: 'bravo', name: 'Bravo', connected: true, ready: false, hand: [] },
      offline: { id: 'offline', name: 'Offline', connected: false, ready: false, hand: [3, 7] },
      cpu: { id: 'cpu', name: 'CPU', connected: true, ready: false, hand: [5], isCpu: true },
    },
    game: {
      phase: 'playing', currentLevel: 1, maxLevel: 2, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
      rewardMap: {}, mode: 'dev-cpu', starProposal: null, interactionLock: null, startedAt: 0, errorCounts: {}, finalResults: null,
    },
  };
}

test('proposal is deterministic and immutable, auto-accepts CPU, and includes connected empty hands in consensus', () => {
  const source = match();
  const before = structuredClone(source);
  const proposed = proposeStar(source, 'alpha', input);
  assert.equal(proposed.ok, true);
  assert.deepEqual(source, before);
  if (!proposed.ok) return;
  assert.deepEqual(proposed.state.game?.starProposal, { initiatorId: 'alpha', acceptedBy: ['alpha', 'cpu'] });
  assert.deepEqual(proposed.events, [{ type: 'star-proposed', playerId: 'alpha' }, { type: 'star-accepted', playerId: 'cpu' }]);
  const same = proposeStar(source, 'alpha', input);
  assert.deepEqual(proposed, same);
});

test('only the proposer cancels, other participants reject, and votes are idempotent', () => {
  const source = match();
  source.players.bravo.hand = [8];
  const proposed = proposeStar(source, 'alpha', input);
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  assert.deepEqual(cancelStar(proposed.state, 'bravo', input.now), { ok: false, error: 'Only the proposing player can cancel the star' });
  assert.equal(rejectStar(proposed.state, 'bravo', input.now).ok, true);
  assert.equal(cancelStar(proposed.state, 'alpha', input.now).ok, true);
  const accepted = acceptStar(proposed.state, 'alpha', input);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.deepEqual(accepted.events, []);
  assert.deepEqual(accepted.state, proposed.state);
});

test('full consensus consumes once and previews every non-empty hand without settlement mutation', () => {
  const proposed = proposeStar(match(), 'alpha', input);
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  const accepted = acceptStar(proposed.state, 'bravo', input);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.state.game?.stars, 0);
  assert.equal(accepted.state.game?.starProposal, null);
  assert.deepEqual(accepted.state.players.alpha.hand, [9, 2]);
  assert.deepEqual(accepted.state.game?.starResolution?.discarded, [
    { card: 2, playerId: 'alpha', playerName: 'Alpha' },
    { card: 3, playerId: 'offline', playerName: 'Offline' },
    { card: 5, playerId: 'cpu', playerName: 'CPU' },
  ]);
  assert.deepEqual(accepted.effects, [{ type: 'schedule', trigger: 'star-settled', reason: 'star', dueAt: 150, expected: { phase: 'playing', lockReason: 'star', lockUntil: 150 } }]);
  assert.equal(acceptStar(accepted.state, 'bravo', input).ok, false);
});

test('settlement applies its preview once, includes disconnected hands, and rejects stale or repeated commands', () => {
  const proposed = proposeStar(match(), 'alpha', input);
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  const accepted = acceptStar(proposed.state, 'bravo', input);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const effect = accepted.effects[0]!;
  const source = structuredClone(accepted.state);
  const settled = settleStar(accepted.state, 'alpha', effect, { now: 110, roundFlipMs: input.roundFlipMs });
  assert.equal(settled.ok, true);
  assert.deepEqual(accepted.state, source);
  if (!settled.ok) return;
  assert.deepEqual(settled.state.players.alpha.hand, [9]);
  assert.deepEqual(settled.state.players.offline.hand, [7]);
  assert.deepEqual(settled.state.players.cpu.hand, []);
  assert.equal(settled.state.game?.starResolution, null);
  assert.equal(settled.state.game?.phase, 'paused');
  assert.deepEqual(settled.events.map((event) => event.type), ['star-settled', 'card-discarded', 'card-discarded', 'card-discarded', 'star-outcome']);
  assert.deepEqual(settleStar(settled.state, 'alpha', effect, { now: 110, roundFlipMs: input.roundFlipMs }), { ok: false, error: 'Stale timed transition' });
  const stale = { ...effect, expected: { ...effect.expected, lockUntil: 999 } };
  assert.deepEqual(settleStar(accepted.state, 'alpha', stale, { now: 110, roundFlipMs: input.roundFlipMs }), { ok: false, error: 'Stale timed transition' });
});

test('a settlement that empties all hands declares the card close effect without shell recomputation', () => {
  const source = match();
  source.players.alpha.hand = [2];
  source.players.offline.hand = [];
  source.players.cpu.hand = [];
  const proposed = proposeStar(source, 'alpha', input);
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  const accepted = acceptStar(proposed.state, 'bravo', input);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const settled = settleStar(accepted.state, 'alpha', accepted.effects[0]!, { now: 120, roundFlipMs: 7 });
  assert.equal(settled.ok, true);
  if (!settled.ok) return;
  assert.deepEqual(settled.events.map((event) => event.type), ['star-settled', 'card-discarded', 'star-outcome']);
  assert.deepEqual(settled.effects, [{ type: 'schedule', trigger: 'round-flip-expired', dueAt: 127, expected: { phase: 'playing', lockReason: null, lockUntil: null } }]);
});
