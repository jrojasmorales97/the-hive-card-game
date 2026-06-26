export type InteractionLockReason = 'dealing' | 'countdown' | 'error' | 'star' | 'level-complete';

export type InteractionLock = {
  reason: InteractionLockReason;
  until: number;
};

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

export function countdownValueFromRemaining(ms: number): 3 | 2 | 1 | 'play' | null {
  if (ms <= 0) return null;
  if (ms > 2000) return 3;
  if (ms > 1000) return 2;
  return 1;
}
