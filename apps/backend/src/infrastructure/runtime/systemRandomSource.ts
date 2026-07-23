import type { RandomSource } from '../../application/ports/randomSource.js';

/** Production owner of the process random source. */
export class SystemRandomSource implements RandomSource {
  constructor(private readonly random: () => number = Math.random) {}

  next(): number { return this.random(); }
}

export const systemRandomSource: RandomSource = new SystemRandomSource();
