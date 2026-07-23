import type { Clock } from '../../application/ports/clock.js';

/** Deterministic clock for tests and simulations. */
export class ManualClock implements Clock {
  constructor(private current: number = 0) {
    if (!Number.isFinite(current)) throw new RangeError('Clock time must be finite');
  }

  now(): number { return this.current; }

  set(now: number): void {
    if (!Number.isFinite(now)) throw new RangeError('Clock time must be finite');
    this.current = now;
  }

  advance(durationMs: number): number {
    if (!Number.isFinite(durationMs)) throw new RangeError('Clock duration must be finite');
    this.current += durationMs;
    return this.current;
  }
}
