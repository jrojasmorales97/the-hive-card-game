import { evaluateGameTransition, type GameTrigger, type MachineState } from '../gameStateMachine.js';
import type { DomainMatch } from './model.js';
import { rejected, succeeded, type DomainEffect, type DomainResult } from './result.js';

export type CardDurations = { errorOverlayMs: number; roundFlipMs: number; roundUnflipMs: number };

function copyMatch(match: DomainMatch): DomainMatch {
  return structuredClone(match);
}

function machineState(match: DomainMatch, actorId: string, card?: number): MachineState {
  const game = match.game;
  return {
    roomStatus: match.status, phase: game?.phase ?? null, lock: game?.interactionLock ?? null,
    lives: game?.lives ?? 0, stars: game?.stars ?? 0, hasStarProposal: Boolean(game?.starProposal),
    starInitiatorId: game?.starProposal?.initiatorId ?? null, acceptedStarBy: game?.starProposal?.acceptedBy ?? [],
    isHost: match.hostId === actorId, actorId, players: Object.values(match.players), card,
  };
}

function applyPatch(match: DomainMatch, patch: { phase?: NonNullable<DomainMatch['game']>['phase']; lock?: NonNullable<DomainMatch['game']>['interactionLock'] }): void {
  if (!match.game) return;
  if (patch.phase !== undefined) match.game.phase = patch.phase;
  if (patch.lock !== undefined) match.game.interactionLock = patch.lock;
}

function remainingCards(match: DomainMatch): number {
  return Object.values(match.players).reduce((total, player) => total + player.hand.length, 0);
}

function outcome(match: DomainMatch): 'game-over' | 'level-complete' | 'pause' {
  if (!match.game || match.game.lives <= 0) return 'game-over';
  return remainingCards(match) === 0 ? 'level-complete' : 'pause';
}

function expectedEffect(trigger: Extract<GameTrigger, 'error-expired' | 'round-flip-expired' | 'round-unflip-expired'>, dueAt: number, match: DomainMatch): DomainEffect {
  const game = match.game!;
  return {
    type: 'schedule', trigger, dueAt,
    expected: { phase: game.phase, lockReason: game.interactionLock?.reason ?? null, lockUntil: game.interactionLock?.until ?? null },
  };
}

/** Validates and applies a single card command without mutating the source match. */
export function playCard(match: DomainMatch, actorId: string, card: number, now: number, durations: CardDurations): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId, card), 'play', now);
  if (!decision.ok) return rejected(decision.error);
  if (!match.game) return rejected('Invalid game state');

  const next = copyMatch(match);
  const game = next.game!;
  const actor = next.players[actorId];
  if (!actor) return rejected('Invalid game state');
  actor.hand = actor.hand.filter((value) => value !== card);
  const blockingCards = Object.values(next.players)
    .flatMap((player) => player.hand.filter((value) => value < card).map((value) => ({ value, playerId: player.id })))
    .sort((left, right) => left.value - right.value || left.playerId.localeCompare(right.playerId));

  game.pile.push(card);
  game.pileHistory.push({ value: card, playerId: actorId, ts: now, source: 'manual' });
  game.lastPlayed = card;
  game.starProposal = null;
  const events: NonNullable<Extract<DomainResult, { ok: true }>['events']> = [{ type: 'card-played', playerId: actorId, card }];

  if (blockingCards.length === 0) {
    if (outcome(next) !== 'level-complete') return succeeded(next, events);
    const dueAt = now + Math.max(0, durations.roundFlipMs);
    return succeeded(next, events, [expectedEffect('round-flip-expired', dueAt, next)]);
  }

  game.lives = Math.max(0, game.lives - 1);
  game.errorCounts[actorId] = (game.errorCounts[actorId] ?? 0) + 1;
  blockingCards.forEach(({ playerId, value }) => {
    const player = next.players[playerId]!;
    player.hand = player.hand.filter((handCard) => handCard !== value);
  });
  const until = now + Math.max(0, durations.errorOverlayMs);
  game.interactionLock = { reason: 'error', until };
  events.push(
    { type: 'error-penalty', playerId: actorId, card, blockingCards, lifeLost: 1 },
    ...blockingCards.map(({ playerId, value }) => ({ type: 'card-discarded' as const, playerId, card: value, reason: 'error' as const })),
  );
  return succeeded(next, events, [expectedEffect('error-expired', until, next)]);
}

/** Declares the shared round-close effect after another domain action has exhausted every hand. */
export function scheduleRoundCompletion(match: DomainMatch, actorId: string, now: number, durations: CardDurations): DomainResult {
  if (match.game?.phase !== 'playing' || remainingCards(match) !== 0) return rejected('Invalid game state');
  if (!match.players[actorId]) return rejected('Invalid game state');
  const next = copyMatch(match);
  return succeeded(next, [], [expectedEffect('round-flip-expired', now + Math.max(0, durations.roundFlipMs), next)]);
}

/** Resolves declared card effects once, rejecting stale callbacks before any state mutation. */
export function expireCardEffect(match: DomainMatch, actorId: string, effect: DomainEffect, now: number, durations: CardDurations): DomainResult {
  const game = match.game;
  if (!game || game.phase !== effect.expected.phase || (game.interactionLock?.reason ?? null) !== effect.expected.lockReason || (game.interactionLock?.until ?? null) !== effect.expected.lockUntil || now < effect.dueAt) {
    return rejected('Stale timed transition');
  }
  const trigger = effect.trigger as GameTrigger;
  if (trigger !== 'error-expired' && trigger !== 'round-flip-expired' && trigger !== 'round-unflip-expired') return rejected('Stale timed transition');
  const decision = evaluateGameTransition(machineState(match, actorId), trigger, now);
  if (!decision.ok) return rejected(decision.error);

  const next = copyMatch(match);
  applyPatch(next, decision.patch);
  if (trigger === 'round-flip-expired') {
    const dueAt = now + Math.max(0, durations.roundUnflipMs);
    return succeeded(next, [], [expectedEffect('round-unflip-expired', dueAt, next)]);
  }
  if (trigger === 'round-unflip-expired') return succeeded(next, [{ type: 'card-outcome', outcome: 'level-complete' }]);

  const resolved = outcome(next);
  if (resolved === 'pause') {
    const pauseActorId = next.players[actorId]?.hand.length ? actorId : Object.values(next.players).find((player) => player.hand.length > 0)?.id;
    if (!pauseActorId) return rejected('Invalid game state');
    const pause = evaluateGameTransition(machineState(next, pauseActorId), 'pause', now);
    if (!pause.ok) return rejected(pause.error);
    applyPatch(next, pause.patch);
    return succeeded(next, [{ type: 'round-paused', playerId: pauseActorId }, { type: 'card-outcome', outcome: resolved }]);
  }
  if (resolved === 'level-complete' && next.game) next.game.phase = 'level-complete';
  return succeeded(next, [{ type: 'card-outcome', outcome: resolved }]);
}
