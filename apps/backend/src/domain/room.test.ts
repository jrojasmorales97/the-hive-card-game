import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRoomJoin, validateLobbyKickRequest, validateLobbyStartRequest } from './room.js';

test('validateLobbyStartRequest allows host start from lobby without ready state checks', () => {
  assert.deepEqual(
    validateLobbyStartRequest({
      isHost: true,
      roomStatus: 'lobby',
      hasGame: false,
      connectedPlayerCount: 2,
    }),
    { ok: true },
  );
});

test('validateLobbyStartRequest keeps start host-only and enforces minimum players', () => {
  assert.deepEqual(
    validateLobbyStartRequest({
      isHost: false,
      roomStatus: 'lobby',
      hasGame: false,
      connectedPlayerCount: 3,
    }),
    { ok: false, error: 'Only the host can start the game' },
  );

  assert.deepEqual(
    validateLobbyStartRequest({
      isHost: true,
      roomStatus: 'lobby',
      hasGame: false,
      connectedPlayerCount: 1,
    }),
    { ok: false, error: 'Need at least 2 connected players' },
  );
});

test('resolveRoomJoin rejects new players after the room left the lobby but allows reconnection', () => {
  assert.deepEqual(resolveRoomJoin({ roomStatus: 'in-game', existingPlayer: false }), {
    ok: false,
    error: 'The game already started in this room',
  });

  assert.deepEqual(resolveRoomJoin({ roomStatus: 'in-game', existingPlayer: true }), {
    ok: true,
    reconnect: true,
  });
});

test('validateLobbyKickRequest keeps removal host-only and lobby-only', () => {
  assert.deepEqual(
    validateLobbyKickRequest({
      isHost: false,
      roomStatus: 'lobby',
      actorId: 'host',
      targetId: 'guest',
      targetExists: true,
    }),
    { ok: false, error: 'Only the host can remove players' },
  );

  assert.deepEqual(
    validateLobbyKickRequest({
      isHost: true,
      roomStatus: 'in-game',
      actorId: 'host',
      targetId: 'guest',
      targetExists: true,
    }),
    { ok: false, error: 'Players can only be removed from the lobby' },
  );
});
