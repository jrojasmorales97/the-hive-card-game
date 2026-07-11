export type InteractionLockReason = 'dealing' | 'countdown' | 'error' | 'star' | 'level-complete';

export type InteractionLock = {
  reason: InteractionLockReason;
  until: number;
};

type RoomStatus = 'lobby' | 'in-game';
type GamePhase = 'focus' | 'playing' | 'paused' | 'round-complete' | 'level-complete' | 'game-over' | 'victory';

export function isInteractionLockActive(lock: InteractionLock | null | undefined, now = Date.now()): boolean {
  return Boolean(lock && lock.until > now);
}

export function isCountdownLockActive(lock: InteractionLock | null | undefined, now = Date.now()): boolean {
  return Boolean(lock?.reason === 'countdown' && isInteractionLockActive(lock, now));
}

export function isHandDealInProgress(
  lock: InteractionLock | null | undefined,
  handLength: number,
  dealtHandCount: number,
  now = Date.now(),
): boolean {
  if (lock?.reason === 'dealing' && isInteractionLockActive(lock, now)) return true;
  return handLength > 0 && dealtHandCount < handLength;
}

export function isReadyLocked(lock: InteractionLock | null | undefined, now = Date.now()): boolean {
  return isInteractionLockActive(lock, now);
}

export function handDealStateKey(input: {
  handKey: string;
  roomStatus: RoomStatus | null;
  phase: GamePhase | null;
}): string {
  return `${input.handKey}::${input.roomStatus ?? 'none'}::${input.phase ?? 'none'}`;
}

export function handDealAnimationMode(input: {
  handLength: number;
  roomStatus: RoomStatus | null;
  phase: GamePhase | null;
}): 'clear' | 'animate' | 'reveal' {
  if (input.handLength === 0) return 'clear';
  if (input.roomStatus === 'in-game' && input.phase === 'focus') return 'animate';
  return 'reveal';
}

export function lobbyStartDealDelayMs(input: {
  previousRoomStatus: RoomStatus | null;
  nextRoomStatus: RoomStatus | null;
  nextPhase: GamePhase | null;
  forceRevealHand?: boolean;
}): number {
  return 0;
}

export function countdownValueFromRemaining(ms: number): 3 | 2 | 1 | 'play' | null {
  if (ms <= 0) return null;
  if (ms > 2000) return 3;
  if (ms > 1000) return 2;
  return 1;
}
