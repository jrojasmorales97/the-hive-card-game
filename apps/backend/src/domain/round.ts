import { evaluateGameTransition, type GameTrigger, type MachineState } from '../gameStateMachine.js';
import type { DomainMatch } from './model.js';
import { hasAllReadyForRound, pauseParticipants } from './participants.js';
import { rejected, succeeded, type DomainEffect, type DomainResult } from './result.js';

export type RoundInput = { now: number; countdownMs: number };

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

function applyPatch(match: DomainMatch, patch: { roomStatus?: DomainMatch['status']; phase?: NonNullable<DomainMatch['game']>['phase']; lock?: NonNullable<DomainMatch['game']>['interactionLock'] }): void {
  if (patch.roomStatus !== undefined) match.status = patch.roomStatus;
  if (!match.game) return;
  if (patch.phase !== undefined) match.game.phase = patch.phase;
  if (patch.lock !== undefined) match.game.interactionLock = patch.lock;
}

function countdownEffect(match: DomainMatch, actorId: string, input: RoundInput): DomainEffect[] {
  const decision = evaluateGameTransition({ ...machineState(match, actorId), countdownMs: input.countdownMs }, 'countdown-started', input.now);
  if (!decision.ok) return [];
  applyPatch(match, decision.patch);
  const lock = match.game!.interactionLock!;
  return [{ type: 'schedule', trigger: 'countdown-expired', dueAt: lock.until, expected: { phase: match.game!.phase, lockReason: lock.reason, lockUntil: lock.until } }];
}

/** Applies a ready command and declares a countdown only after the canonical quorum is complete. */
export function setRoundReady(match: DomainMatch, actorId: string, ready: boolean, input: RoundInput): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId), ready ? 'ready' : 'unready', input.now);
  if (!decision.ok) return rejected(decision.error);
  const next = copyMatch(match);
  const player = next.players[actorId];
  if (!player) return rejected('Invalid game state');
  player.ready = ready;
  Object.values(next.players).forEach((entry) => {
    if (entry.isCpu) { entry.connected = true; entry.ready = true; }
  });
  const effects = next.game && (next.game.phase === 'focus' || next.game.phase === 'paused') && hasAllReadyForRound({ players: Object.values(next.players) })
    ? countdownEffect(next, actorId, input)
    : [];
  return succeeded(next, [], effects);
}

/** Pauses an active round, clearing ready only for active players and preserving CPU readiness. */
export function pauseRound(match: DomainMatch, actorId: string, now: number): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId), 'pause', now);
  if (!decision.ok) return rejected(decision.error);
  const next = copyMatch(match);
  applyPatch(next, decision.patch);
  pauseParticipants({ players: Object.values(next.players) }).forEach((player) => { player.ready = false; });
  Object.values(next.players).forEach((player) => {
    if (player.isCpu) { player.connected = true; player.ready = true; }
  });
  return succeeded(next, [{ type: 'round-paused', playerId: actorId }]);
}

/** Resolves a timer only when its original phase, lock reason and deadline still match. */
export function expireRoundEffect(match: DomainMatch, actorId: string, effect: DomainEffect, now: number, countdownMs: number): DomainResult {
  const game = match.game;
  if (!game || game.phase !== effect.expected.phase || game.interactionLock?.reason !== effect.expected.lockReason || game.interactionLock?.until !== effect.expected.lockUntil) {
    return rejected('Stale timed transition');
  }
  const trigger = effect.trigger as GameTrigger;
  if (trigger !== 'dealing-expired' && trigger !== 'countdown-expired') return rejected('Stale timed transition');
  const decision = evaluateGameTransition(machineState(match, actorId), trigger, now);
  if (!decision.ok) return rejected(decision.error);
  const next = copyMatch(match);
  applyPatch(next, decision.patch);
  if (trigger === 'countdown-expired') Object.values(next.players).forEach((player) => { player.ready = false; });
  const effects = trigger === 'dealing-expired' && hasAllReadyForRound({ players: Object.values(next.players) })
    ? countdownEffect(next, actorId, { now, countdownMs })
    : [];
  return succeeded(next, [], effects);
}
