import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationRoom } from '../../application/model.js';
import { RoomPresenter } from './roomPresenter.js';

function room(): ApplicationRoom {
  return {
    code: 'ROOM01', displayCode: 'ROOM01', shareable: true, hostId: 'host', status: 'lobby', version: 4, logs: [], game: null,
    players: {
      host: { id: 'host', name: 'Host', connected: true, ready: false, hand: [9, 2] },
      guest: { id: 'guest', name: 'Guest', connected: true, ready: false, hand: [7] },
    },
  };
}

test('room presenter keeps public broadcasts separate from owner-only hands', () => {
  const presenter = new RoomPresenter({ now: () => 1234 });
  const current = room();
  const publicState = presenter.publicState(current);
  const snapshot = presenter.snapshot(current, current.players.host);

  assert.deepEqual(publicState.players.map((player) => ({ id: player.id, handCount: player.handCount })), [{ id: 'host', handCount: 2 }, { id: 'guest', handCount: 1 }]);
  assert.equal(JSON.stringify(publicState).includes('hand'), true, 'handCount is public');
  assert.equal(JSON.stringify(publicState).includes('[9,2]'), false);
  assert.deepEqual(snapshot.privateState.hand, [2, 9]);
  assert.equal('socketId' in publicState.players[0], false);
});

test('room presenter uses one supplied instant for snapshot time and lock capabilities', () => {
  const calls: number[] = [];
  const presenter = new RoomPresenter({ now: () => { calls.push(1); return 2000; } });
  const current = room();
  current.status = 'in-game';
  current.game = {
    phase: 'playing', currentLevel: 1, maxLevel: 12, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
    rewardMap: {}, mode: 'normal', starProposal: null, interactionLock: { reason: 'countdown', until: 2001 }, startedAt: 0, errorCounts: {}, finalResults: null,
  };

  const snapshot = presenter.snapshot(current, current.players.host);

  assert.equal(snapshot.serverTime, 2000);
  assert.equal(snapshot.privateState.availableActions.find((action) => action.type === 'play_card')?.enabled, false);
  assert.equal(calls.length, 1);
});
