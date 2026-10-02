import type { ApplicationEffect } from '../result.js';

/** Scheduling the same room/key replaces earlier work; cancelRoom removes every pending job. */
export interface Scheduler {
  schedule(roomCode: string, key: string, effect: ApplicationEffect): void;
  cancel(roomCode: string, key: string): void;
  cancelRoom(roomCode: string): void;
  cancelAll(): void;
  /** Preserve pending deadlines across a presence-only commit, without reviving stale jobs. */
  rebaseRoom(roomCode: string, previousVersion: number, nextVersion: number): void;
}
