import type { Clock } from '../../application/ports/clock.js';

/** Production owner of the process wall clock. */
export class SystemClock implements Clock {
  now(): number { return Date.now(); }
}

export const systemClock: Clock = new SystemClock();
