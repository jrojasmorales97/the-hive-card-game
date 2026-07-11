import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLobbySeats, shouldShowTopbarRoomCode, waitingRoomMessage } from './lobbyUi.js';

test('buildLobbySeats keeps all lobby seats visible up to the table capacity', () => {
  assert.deepEqual(buildLobbySeats(['a'], 8), ['a', null, null, null, null, null, null, null]);
  assert.deepEqual(buildLobbySeats(['a', 'b', 'c'], 5), ['a', 'b', 'c', null, null]);
  assert.deepEqual(buildLobbySeats(['a', 'b', 'c', 'd'], 8), ['a', 'b', 'c', 'd', null, null, null, null]);
});

test('shouldShowTopbarRoomCode hides the duplicate room pill during lobby only', () => {
  assert.equal(shouldShowTopbarRoomCode('lobby'), false);
  assert.equal(shouldShowTopbarRoomCode('in-game'), true);
});

test('waitingRoomMessage changes depending on whether the local player is host', () => {
  assert.equal(waitingRoomMessage({ isHost: true, hostName: 'Chus' }), 'Share the code and start when ready.');
  assert.equal(waitingRoomMessage({ isHost: false, hostName: 'Chus' }), 'Waiting for Chus to start.');
});
