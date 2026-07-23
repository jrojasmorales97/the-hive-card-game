import type { RandomSource } from '../../application/ports/randomSource.js';
export const systemRandomSource: RandomSource = { next: () => Math.random() };
