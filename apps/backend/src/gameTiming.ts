import type { InteractionLock, InteractionLockReason } from '@the-hive/contracts';
export type { InteractionLock, InteractionLockReason } from '@the-hive/contracts';

export const DEAL_CARD_INTERVAL_MS = 460;
export const DEAL_SETTLE_MS = 80;
export const ERROR_LOCK_MS = 5000;
export const STAR_RESOLUTION_LOCK_MS = 5000;
export const LEVEL_COMPLETE_LOCK_MS = 5000;

export function createInteractionLock(reason: InteractionLockReason, durationMs: number, now: number): InteractionLock {
  return {
    reason,
    until: now + Math.max(0, durationMs),
  };
}

export function isInteractionLockActive(lock: InteractionLock | null | undefined, now: number): boolean {
  return Boolean(lock && lock.until > now);
}

export function getDealLockDuration(cardCount: number): number {
  return Math.max(0, cardCount) * DEAL_CARD_INTERVAL_MS + DEAL_SETTLE_MS;
}
