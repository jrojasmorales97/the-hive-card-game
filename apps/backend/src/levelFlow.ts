import type { InteractionLock } from './gameTiming.js';

export function nextLevelAdvanceDelayMs(lock: InteractionLock | null | undefined, now = Date.now()): number {
  if (lock?.reason !== 'star') return 0;
  return Math.max(0, lock.until - now);
}

export function nextLevelReadyLockMs(levelCompleteLockMs: number, dealLockMs: number): number {
  return Math.max(levelCompleteLockMs, dealLockMs);
}
