/* node:coverage ignore next -- declaration-only contract surface */
import type { PrivateAction } from './actions.js';

export type RoomStatus = 'lobby' | 'in-game';
export type GamePhase = 'focus' | 'playing' | 'paused' | 'round-complete' | 'level-complete' | 'game-over' | 'victory';
export type InteractionLockReason = 'dealing' | 'countdown' | 'error' | 'star' | 'level-complete';
export type InteractionLock = { reason: InteractionLockReason; until: number };
export type RewardType = 'life' | 'star';
export type GameMode = 'normal' | 'dev-cpu';

export type PublicPlayerState = {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  handCount: number;
  isCpu?: boolean;
};
export type PileEntry = { value: number; playerId: string; ts: number; source: 'manual' | 'star' };
export type FinalPlayerResult = {
  playerId: string; playerName: string; score: number;
  timingBand: 'sync' | 'slightly-fast' | 'very-fast' | 'slightly-slow' | 'very-slow' | 'unrated';
  direction: 'fast' | 'slow' | 'steady' | 'unknown'; avgDeviationMs: number;
  errorPenalty: number; errorCount: number; summary: string; roast: string;
};
export type StarProposal = { initiatorId: string; acceptedBy: string[] };
export type PublicGameState = {
  phase: GamePhase; currentLevel: number; maxLevel: number; lives: number; stars: number;
  pile: number[]; pileHistory: PileEntry[]; lastPlayed: number | null; mode: GameMode;
  interactionLock: InteractionLock | null; finalResults: FinalPlayerResult[] | null;
  starProposal: StarProposal | null;
};
export type PublicRoomState = {
  code: string; displayCode: string; shareable: boolean; hostId: string; status: RoomStatus;
  players: PublicPlayerState[]; game: PublicGameState | null; logs: import('./logs.js').GameLogEvent[];
};
export type PrivatePlayerState = { hand: number[]; availableActions: PrivateAction[] };
export type PublicRoomEnvelope = { version: number; serverTime: number; publicState: PublicRoomState };
export type PrivatePlayerEnvelope = { version: number; serverTime: number; privateState: PrivatePlayerState };
export type RoomSnapshot = PublicRoomEnvelope & { privateState: PrivatePlayerState };
