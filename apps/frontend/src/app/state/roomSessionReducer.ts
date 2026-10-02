import type { PrivateAction, PublicRoomState, RoomSnapshot } from '@the-hive/contracts';

export type ServerState = {
  room: PublicRoomState | null;
  hand: number[];
  availableActions: PrivateAction[];
};

export type ServerStateAction =
  | { type: 'snapshot-applied'; snapshot: RoomSnapshot }
  | { type: 'room-cleared' };

export function initialServerState(): ServerState {
  return { room: null, hand: [], availableActions: [] };
}

export function roomSessionReducer(state: ServerState, action: ServerStateAction): ServerState {
  if (action.type === 'room-cleared') return initialServerState();
  return {
    room: action.snapshot.publicState,
    hand: action.snapshot.privateState.hand ?? [],
    availableActions: action.snapshot.privateState.availableActions ?? [],
  };
}
