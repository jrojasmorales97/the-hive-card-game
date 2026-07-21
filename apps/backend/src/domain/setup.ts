import { evaluateGameTransition, type GameTrigger, type MachineState } from '../gameStateMachine.js';
import type { DomainGame, DomainMatch, DomainPlayer, DomainRewardType } from './model.js';
import { rejected, succeeded, type DomainResult } from './result.js';

export const GAME_BALANCE: Record<number, { maxLevel: number; lives: number }> = {
  2: { maxLevel: 12, lives: 2 },
  3: { maxLevel: 10, lives: 3 },
  4: { maxLevel: 8, lives: 4 },
  5: { maxLevel: 8, lives: 4 },
  6: { maxLevel: 7, lives: 5 },
  7: { maxLevel: 6, lives: 5 },
  8: { maxLevel: 5, lives: 5 },
};

const MAX_PLAYERS = 8;
const REWARDS: Record<number, DomainRewardType> = { 2: 'star', 3: 'life', 5: 'star', 6: 'life', 8: 'star', 9: 'life' };

export type SetupInput = { now: number; deck: readonly number[]; dealingMs: number; retryBannerMs?: number };

function copyMatch(match: DomainMatch): DomainMatch {
  return structuredClone(match);
}

function machineState(match: DomainMatch, actorId: string): MachineState {
  const game = match.game;
  return {
    roomStatus: match.status,
    phase: game?.phase ?? null,
    lock: game?.interactionLock ?? null,
    lives: game?.lives ?? 0,
    stars: game?.stars ?? 0,
    hasStarProposal: Boolean(game?.starProposal),
    starInitiatorId: game?.starProposal?.initiatorId ?? null,
    acceptedStarBy: game?.starProposal?.acceptedBy ?? [],
    isHost: match.hostId === actorId,
    actorId,
    players: Object.values(match.players),
  };
}

export function balanceForPlayers(playerCount: number): { maxLevel: number; lives: number } {
  return GAME_BALANCE[playerCount] ?? GAME_BALANCE[MAX_PLAYERS];
}

export function buildRewardMap(maxLevel: number): Record<number, DomainRewardType> {
  return Object.fromEntries(Object.entries(REWARDS).filter(([level]) => Number(level) <= maxLevel)) as Record<number, DomainRewardType>;
}

function dealtPlayers(players: Record<string, DomainPlayer>, deck: readonly number[], level: number, resetReady: boolean): Record<string, DomainPlayer> {
  let cursor = 0;
  return Object.fromEntries(Object.entries(players).map(([id, player]) => {
    const hand = deck.slice(cursor, cursor + level).sort((left, right) => left - right);
    cursor += level;
    return [id, { ...player, hand, ready: resetReady || player.isCpu ? Boolean(player.isCpu) : player.ready }];
  }));
}

function initialGame(match: DomainMatch, now: number): DomainGame {
  const balance = balanceForPlayers(Object.keys(match.players).length);
  return {
    phase: 'focus', currentLevel: 1, maxLevel: balance.maxLevel, lives: balance.lives, stars: 1,
    pile: [], pileHistory: [], lastPlayed: null, rewardMap: buildRewardMap(balance.maxLevel),
    mode: Object.values(match.players).some((player) => player.isCpu) ? 'dev-cpu' : 'normal',
    starProposal: null, interactionLock: null, startedAt: now, errorCounts: {}, finalResults: null,
  };
}

function startOrRetry(match: DomainMatch, actorId: string, input: SetupInput, trigger: Extract<GameTrigger, 'start' | 'retry'>): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId), trigger, input.now);
  if (!decision.ok) return rejected(decision.error);

  const next = copyMatch(match);
  next.status = 'in-game';
  next.game = initialGame(next, input.now);
  const resetReady = trigger === 'retry';
  next.players = dealtPlayers(next.players, input.deck, next.game.currentLevel, resetReady);
  const dealingMs = trigger === 'retry' ? Math.max(input.dealingMs, input.retryBannerMs ?? 0) : input.dealingMs;
  const until = input.now + Math.max(0, dealingMs);
  next.game.interactionLock = { reason: 'dealing', until };
  return succeeded(next, [{ type: trigger === 'start' ? 'game-started' : 'game-restarted', startedAt: input.now }], [{
    type: 'schedule', trigger: 'dealing-expired', dueAt: until,
    expected: { phase: 'focus', lockReason: 'dealing', lockUntil: until },
  }]);
}

/** Starts a manually authorized game with injected time and an already shuffled deck. */
export function startGame(match: DomainMatch, actorId: string, input: SetupInput): DomainResult {
  return startOrRetry(match, actorId, input, 'start');
}

/** Retries in the same room and resets human ready state while keeping CPU synchronization. */
export function retryGame(match: DomainMatch, actorId: string, input: SetupInput): DomainResult {
  return startOrRetry(match, actorId, input, 'retry');
}

/** Deals the current level without choosing a deck or scheduling infrastructure. */
export function dealLevel(match: DomainMatch, deck: readonly number[], resetReady = true): DomainResult {
  if (!match.game) return rejected('Invalid game state');
  const next = copyMatch(match);
  const game = next.game!;
  next.players = dealtPlayers(next.players, deck, game.currentLevel, resetReady);
  game.pile = [];
  game.pileHistory = [];
  game.lastPlayed = null;
  game.phase = 'focus';
  game.starProposal = null;
  game.finalResults = null;
  return succeeded(next);
}
