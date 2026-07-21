import assert from 'node:assert/strict';
import test from 'node:test';

import { applyDomainResult, toDomainMatch, type AdaptableRoom } from './domainAdapter.js';

function room(): AdaptableRoom {
  return {
    code: 'HIVE01', displayCode: 'HIVE01', shareable: true, hostId: 'alpha', status: 'in-game', version: 7, logs: [{ type: 'kept' }],
    players: {
      alpha: { id: 'alpha', name: 'Alpha', socketId: 'socket-a', connected: true, ready: false, hand: [8] },
      beta: { id: 'beta', name: 'Beta', socketId: null, connected: false, ready: true, hand: [3] },
    },
    game: {
      phase: 'playing', currentLevel: 1, maxLevel: 12, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
      rewardMap: {}, mode: 'normal', starProposal: { initiatorId: 'alpha', acceptedBy: new Set(['alpha']) }, interactionLock: null,
      startedAt: 10, errorCounts: {}, finalResults: null,
    },
  };
}

test('adapter copies functional state without leaking shell metadata', () => {
  const source = room();
  const match = toDomainMatch(source);
  assert.deepEqual(match.players.alpha.hand, [8]);
  assert.equal('socketId' in match.players.alpha, false);
  match.players.alpha.hand.pop();
  assert.deepEqual(source.players.alpha.hand, [8]);
});

test('adapter rejection is a metadata-preserving no-op', () => {
  const source = room();
  const before = structuredClone(source);
  assert.deepEqual(applyDomainResult(source, { ok: false, error: 'No stars left' }), { applied: false, events: [], effects: [] });
  assert.deepEqual(source, before);
});

test('adapter atomically merges a successful result and preserves shell metadata', () => {
  const source = room();
  const next = toDomainMatch(source);
  next.players.alpha.hand = [];
  next.game!.pile = [8];
  const outcome = applyDomainResult(source, {
    ok: true, state: next, events: [{ type: 'card-played', playerId: 'alpha', card: 8 }], effects: [],
  });
  assert.equal(outcome.applied, true);
  assert.equal(source.code, 'HIVE01');
  assert.equal(source.version, 7);
  assert.deepEqual(source.logs, [{ type: 'kept' }]);
  assert.equal(source.players.alpha.socketId, 'socket-a');
  assert.deepEqual(source.players.alpha.hand, []);
  assert.deepEqual(source.game?.pile, [8]);
});

test('adapter supports a game-free functional state without replacing shell metadata', () => {
  const source = room();
  const next = toDomainMatch(source);
  next.game = null;
  assert.deepEqual(applyDomainResult(source, { ok: true, state: next, events: [], effects: [] }), {
    applied: true, events: [], effects: [],
  });
  assert.equal(source.game, null);
  assert.equal(source.players.alpha.socketId, 'socket-a');
});

test('adapter rejects additions and removals before mutating the shell room', () => {
  const added = room();
  const addedState = toDomainMatch(added);
  addedState.players.gamma = { id: 'gamma', name: 'Gamma', connected: true, ready: false, hand: [] };
  assert.throws(() => applyDomainResult(added, { ok: true, state: addedState, events: [], effects: [] }), /cannot add player gamma/);
  assert.equal(added.players.gamma, undefined);

  const removed = room();
  const removedState = toDomainMatch(removed);
  delete removedState.players.beta;
  assert.throws(() => applyDomainResult(removed, { ok: true, state: removedState, events: [], effects: [] }), /cannot remove players/);
  assert.ok(removed.players.beta);
});
