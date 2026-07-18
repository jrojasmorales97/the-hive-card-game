/* node:coverage ignore next -- declaration-only contract surface */
export type GameLogType =
  | 'room:joined' | 'room:left' | 'room:host-changed' | 'room:reconnected'
  | 'game:started' | 'game:card-played' | 'game:error' | 'game:discard' | 'game:paused'
  | 'game:star-proposed' | 'game:star-accepted' | 'game:star-used' | 'game:level-complete'
  | 'game:reward' | 'game:next-level-ready' | 'game:restarted' | 'game:victory' | 'game:over';
export type GameLogPayloadMap = Record<GameLogType, Record<string, unknown>>;
export type GameLogEvent<T extends GameLogType = GameLogType> = {
  id: string; ts: number; roomCode: string; type: T; payload: GameLogPayloadMap[T];
};
