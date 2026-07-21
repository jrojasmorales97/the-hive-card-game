import { evaluateGameTransition, type GameTrigger, type MachineState } from '../gameStateMachine.js';
import type { DomainMatch, DomainRewardType } from './model.js';
import { dealLevel } from './setup.js';
import { calculateFinalResults } from './scoring.js';
import { rejected, succeeded, type DomainEffect, type DomainResult } from './result.js';

export type ProgressionInput = { now: number; deck?: readonly number[]; levelCompleteMs?: number; dealingMs?: number; completedAt?: number };

function copyMatch(match: DomainMatch): DomainMatch {
  return structuredClone(match);
}

function machineState(match: DomainMatch, actorId: string): MachineState {
  const game = match.game;
  return {
    roomStatus: match.status, phase: game?.phase ?? null, lock: game?.interactionLock ?? null,
    lives: game?.lives ?? 0, stars: game?.stars ?? 0, hasStarProposal: Boolean(game?.starProposal),
    starInitiatorId: game?.starProposal?.initiatorId ?? null, acceptedStarBy: game?.starProposal?.acceptedBy ?? [],
    isHost: match.hostId === actorId, actorId, players: Object.values(match.players),
  };
}

function expectedEffect(trigger: 'next-level-expired' | 'level-ready-expired', dueAt: number, match: DomainMatch): DomainEffect {
  const game = match.game!;
  return { type: 'schedule', trigger, dueAt, expected: { phase: game.phase, lockReason: game.interactionLock?.reason ?? null, lockUntil: game.interactionLock?.until ?? null } };
}

function applyReward(game: NonNullable<DomainMatch['game']>): DomainRewardType | null {
  const reward = game.rewardMap[game.currentLevel] ?? null;
  if (reward === 'life') game.lives = Math.min(5, game.lives + 1);
  if (reward === 'star') game.stars = Math.min(3, game.stars + 1);
  return reward;
}

function finalize(next: DomainMatch, actorId: string, trigger: Extract<GameTrigger, 'game-over' | 'victory'>, completedAt: number): DomainResult {
  const decision = evaluateGameTransition(machineState(next, actorId), trigger, completedAt);
  if (!decision.ok) return rejected(decision.error);
  const game = next.game!;
  game.phase = decision.patch.phase!;
  game.interactionLock = decision.patch.lock ?? null;
  game.finalResults = calculateFinalResults({
    players: Object.values(next.players).map(({ id, name, isCpu }) => ({ id, name, isCpu })),
    plays: game.pileHistory, gameStartedAt: game.startedAt, completedAt, errorCounts: game.errorCounts,
  });
  return succeeded(next, [{ type: trigger }]);
}

/** Applies the once-only reward and either declares victory or an expected next-level effect. */
export function completeLevel(match: DomainMatch, actorId: string, input: ProgressionInput): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId), 'level-completed', input.now);
  if (!decision.ok || !match.game) return rejected(decision.ok ? 'Invalid game state' : decision.error);
  const next = copyMatch(match);
  const game = next.game!;
  const reward = applyReward(game);
  const events: Extract<DomainResult, { ok: true }>['events'] = [{ type: 'level-completed', level: game.currentLevel, reward }];
  if (reward) events.push({ type: 'reward-applied', reward });
  if (game.currentLevel >= game.maxLevel) {
    const final = finalize(next, actorId, 'victory', input.completedAt ?? input.now);
    if (!final.ok) return final;
    return succeeded(final.state, [...events, ...final.events]);
  }
  return succeeded(next, events, [expectedEffect('next-level-expired', input.now, next)]);
}

/** Deals the next level only for the matching completion effect, then declares its ready lock. */
export function advanceLevel(match: DomainMatch, actorId: string, effect: DomainEffect, input: Required<Pick<ProgressionInput, 'now' | 'deck' | 'levelCompleteMs' | 'dealingMs'>>): DomainResult {
  const game = match.game;
  if (!game || effect.trigger !== 'next-level-expired' || input.now < effect.dueAt
    || game.phase !== effect.expected.phase || (game.interactionLock?.reason ?? null) !== effect.expected.lockReason || (game.interactionLock?.until ?? null) !== effect.expected.lockUntil) return rejected('Stale timed transition');
  const decision = evaluateGameTransition(machineState(match, actorId), 'next-level-expired', input.now);
  if (!decision.ok) return rejected(decision.error);
  const prepared = copyMatch(match);
  prepared.game!.phase = decision.patch.phase!;
  prepared.game!.currentLevel += 1;
  const dealt = dealLevel(prepared, input.deck);
  if (!dealt.ok) return dealt;
  const next = dealt.state;
  const readyUntil = input.now + Math.max(0, input.levelCompleteMs, input.dealingMs);
  next.game!.interactionLock = { reason: 'level-complete', until: readyUntil };
  return succeeded(next, [{ type: 'next-level-ready', level: next.game!.currentLevel }], [expectedEffect('level-ready-expired', readyUntil, next)]);
}

/** Releases only the exact next-level ready lock, so stale callbacks cannot start a new round. */
export function expireProgressionEffect(match: DomainMatch, actorId: string, effect: DomainEffect, now: number): DomainResult {
  const game = match.game;
  if (!game || effect.trigger !== 'level-ready-expired' || now < effect.dueAt
    || game.phase !== effect.expected.phase || (game.interactionLock?.reason ?? null) !== effect.expected.lockReason || (game.interactionLock?.until ?? null) !== effect.expected.lockUntil) return rejected('Stale timed transition');
  const decision = evaluateGameTransition(machineState(match, actorId), 'level-ready-expired', now);
  if (!decision.ok) return rejected(decision.error);
  const next = copyMatch(match);
  next.game!.interactionLock = decision.patch.lock ?? null;
  return succeeded(next);
}

/** Computes final scoring and sets a terminal phase after the machine accepts the terminal outcome. */
export function finishGame(match: DomainMatch, actorId: string, outcome: 'game-over' | 'victory', completedAt: number): DomainResult {
  if (!match.game) return rejected('Invalid game state');
  return finalize(copyMatch(match), actorId, outcome, completedAt);
}
