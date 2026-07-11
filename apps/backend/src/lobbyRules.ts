export type RoomStatus = 'lobby' | 'in-game';

export function validateLobbyStartRequest(input: {
  isHost: boolean;
  roomStatus: RoomStatus;
  hasGame: boolean;
  connectedPlayerCount: number;
}): { ok: true } | { ok: false; error: string } {
  if (!input.isHost) {
    return { ok: false, error: 'Only the host can start the game' };
  }

  if (input.roomStatus !== 'lobby' || input.hasGame) {
    return { ok: false, error: 'The game already started in this room' };
  }

  if (input.connectedPlayerCount < 2) {
    return { ok: false, error: 'Need at least 2 connected players' };
  }

  return { ok: true };
}

export function resolveRoomJoin(input: {
  roomStatus: RoomStatus;
  existingPlayer: boolean;
}): { ok: true; reconnect: boolean } | { ok: false; error: string } {
  if (input.existingPlayer) {
    return { ok: true, reconnect: true };
  }

  if (input.roomStatus !== 'lobby') {
    return { ok: false, error: 'The game already started in this room' };
  }

  return { ok: true, reconnect: false };
}

export function validateLobbyKickRequest(input: {
  isHost: boolean;
  roomStatus: RoomStatus;
  targetId: string | null | undefined;
  actorId: string;
  targetExists: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.isHost) {
    return { ok: false, error: 'Only the host can remove players' };
  }

  if (input.roomStatus !== 'lobby') {
    return { ok: false, error: 'Players can only be removed from the lobby' };
  }

  if (!input.targetId) {
    return { ok: false, error: 'Missing player to remove' };
  }

  if (input.targetId === input.actorId) {
    return { ok: false, error: 'The host cannot remove themselves' };
  }

  if (!input.targetExists) {
    return { ok: false, error: 'That player is no longer in the room' };
  }

  return { ok: true };
}
