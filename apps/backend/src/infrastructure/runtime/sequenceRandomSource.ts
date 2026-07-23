import type { RandomSource } from '../../application/ports/randomSource.js';

/** Deterministic random source that records every consumed value. */
export class SequenceRandomSource implements RandomSource {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  get reads(): number { return this.index; }

  next(): number {
    if (this.index >= this.values.length) throw new RangeError('Random sequence exhausted');
    const value = this.values[this.index++];
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random values must be finite numbers in [0, 1)');
    return value;
  }
}
