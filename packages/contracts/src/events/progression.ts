/* node:coverage ignore next -- declaration-only contract surface */
import type { RewardType } from '../state.js';
export type LevelCompletePayload = { version: number; levelCompleted: number; reward: RewardType | null; lives: number; stars: number };
export type NextLevelReadyPayload = { version: number; level: number };
export type GameOverPayload = { version: number; reason: string };
