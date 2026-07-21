import assert from 'node:assert/strict';
import test from 'node:test';

import { balanceForPlayers, buildRewardMap, dealLevel, retryGame, startGame } from './setup.js';
import type { DomainMatch } from './model.js';

function lobby(players = 2): DomainMatch {
  return {
    status: 'lobby', hostId: 'player-1', game: null,
    players: Object.fromEntries(Array.from({ length: players }, (_, index) => {
      const id = `player-${index + 1}`;
      return [id, { id, name: id, connected: true, ready: index === 0, hand: [], isCpu: index === players - 1 }];
    })),
  };
}

const deck = Array.from({ length: 100 }, (_, index) => 100 - index);

test('balance and rewards remain stable for every supported player count', () => {
  assert.deepEqual(
    [2, 3, 4, 5, 6, 7, 8].map((players) => [players, balanceForPlayers(players)]),
    [[2, { maxLevel: 12, lives: 2 }], [3, { maxLevel: 10, lives: 3 }], [4, { maxLevel: 8, lives: 4 }], [5, { maxLevel: 8, lives: 4 }], [6, { maxLevel: 7, lives: 5 }], [7, { maxLevel: 6, lives: 5 }], [8, { maxLevel: 5, lives: 5 }]],
  );
  assert.deepEqual(buildRewardMap(5), { 2: 'star', 3: 'life', 5: 'star' });
});

test('start is deterministic, immutable, and deals sorted hands with a declarative deadline', () => {
  const source = lobby();
  const before = structuredClone(source);
  const result = startGame(source, 'player-1', { now: 100, deck, dealingMs: 540 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(source, before);
  assert.equal(result.state.game?.maxLevel, 12);
  assert.equal(result.state.game?.lives, 2);
  assert.equal(result.state.game?.stars, 1);
  assert.deepEqual(result.state.players['player-1'].hand, [100]);
  assert.deepEqual(result.state.players['player-2'].hand, [99]);
  assert.equal(result.state.players['player-1'].ready, true);
  assert.equal(result.state.players['player-2'].ready, true);
  assert.deepEqual(result.effects, [{ type: 'schedule', trigger: 'dealing-expired', dueAt: 640, expected: { phase: 'focus', lockReason: 'dealing', lockUntil: 640 } }]);
});

test('retry resets human ready state, preserves CPU synchronization, and honors the banner duration', () => {
  const source = lobby();
  source.status = 'in-game';
  source.game = {
    phase: 'game-over', currentLevel: 2, maxLevel: 12, lives: 0, stars: 0, pile: [1], pileHistory: [], lastPlayed: 1,
    rewardMap: {}, mode: 'normal', starProposal: null, interactionLock: null, startedAt: 1, errorCounts: {}, finalResults: null,
  };
  const result = retryGame(source, 'player-1', { now: 10, deck, dealingMs: 540, retryBannerMs: 5_000 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.players['player-1'].ready, false);
  assert.equal(result.state.players['player-2'].ready, true);
  assert.equal(result.effects[0]?.dueAt, 5_010);
});

test('dealing the current level clears round state without mutating its input', () => {
  const started = startGame(lobby(), 'player-1', { now: 1, deck, dealingMs: 1 });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const source = started.state;
  source.game!.currentLevel = 2;
  source.game!.pile = [4];
  const before = structuredClone(source);
  const result = dealLevel(source, deck);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(source, before);
  assert.deepEqual(result.state.players['player-1'].hand, [99, 100]);
  assert.deepEqual(result.state.game?.pile, []);
});
