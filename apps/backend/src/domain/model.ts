export type DomainRoomStatus = 'lobby' | 'in-game';
export type DomainGamePhase = 'focus' | 'playing' | 'paused' | 'round-complete' | 'level-complete' | 'game-over' | 'victory';
export type DomainInteractionLockReason = 'dealing' | 'countdown' | 'error' | 'star' | 'level-complete';
export type DomainInteractionLock = { reason: DomainInteractionLockReason; until: number };
export type DomainRewardType = 'life' | 'star';
export type DomainGameMode = 'normal' | 'dev-cpu';

export type DomainPlayer = {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  hand: number[];
  isCpu?: boolean;
};

export type DomainPileEntry = { value: number; playerId: string; ts: number; source: 'manual' | 'star' };
export type DomainStarProposal = { initiatorId: string; acceptedBy: string[] };
export type DomainStarDiscardPreview = { card: number; playerId: string; playerName: string };
export type DomainStarResolution = { initiatorId: string; discarded: DomainStarDiscardPreview[] };
export type DomainFinalPlayerResult = {
  playerId: string;
  playerName: string;
  score: number;
  timingBand: 'sync' | 'slightly-fast' | 'very-fast' | 'slightly-slow' | 'very-slow' | 'unrated';
  direction: 'fast' | 'slow' | 'steady' | 'unknown';
  avgDeviationMs: number;
  errorPenalty: number;
  errorCount: number;
  summary: string;
  roast: string;
};

export type DomainGame = {
  phase: DomainGamePhase;
  currentLevel: number;
  maxLevel: number;
  lives: number;
  stars: number;
  pile: number[];
  pileHistory: DomainPileEntry[];
  lastPlayed: number | null;
  rewardMap: Record<number, DomainRewardType>;
  mode: DomainGameMode;
  starProposal: DomainStarProposal | null;
  /** Settlement data remains functional state until the visual coordinator closes. */
  starResolution?: DomainStarResolution | null;
  interactionLock: DomainInteractionLock | null;
  startedAt: number;
  errorCounts: Record<string, number>;
  finalResults: DomainFinalPlayerResult[] | null;
};

/** Functional game state only: no room code, socket, version, log, timer, or wire data. */
export type DomainMatch = {
  status: DomainRoomStatus;
  hostId: string;
  players: Record<string, DomainPlayer>;
  game: DomainGame | null;
};
