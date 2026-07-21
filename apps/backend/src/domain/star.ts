import { evaluateGameTransition, type MachineState } from '../gameStateMachine.js';
import type { DomainMatch, DomainStarDiscardPreview } from './model.js';
import { consensusParticipants, settlementParticipants } from './participants.js';
import { rejected, succeeded, type DomainEffect, type DomainEvent, type DomainResult } from './result.js';

export type StarInput = { now: number; resolutionMs: number; roundFlipMs: number };

function copyMatch(match: DomainMatch): DomainMatch {
  return structuredClone(match);
}

function machineState(match: DomainMatch, actorId: string, starResolutionMs?: number): MachineState {
  const game = match.game;
  return {
    roomStatus: match.status, phase: game?.phase ?? null, lock: game?.interactionLock ?? null,
    lives: game?.lives ?? 0, stars: game?.stars ?? 0, hasStarProposal: Boolean(game?.starProposal),
    starInitiatorId: game?.starProposal?.initiatorId ?? null, acceptedStarBy: game?.starProposal?.acceptedBy ?? [],
    isHost: match.hostId === actorId, actorId, players: Object.values(match.players), starResolutionMs,
  };
}

function previewSettlement(match: DomainMatch): DomainStarDiscardPreview[] {
  return settlementParticipants({ players: Object.values(match.players) })
    .map((player) => ({ card: Math.min(...player.hand), playerId: player.id, playerName: player.name }))
    .sort((left, right) => left.card - right.card || left.playerName.localeCompare(right.playerName));
}

function startResolution(next: DomainMatch, initiatorId: string, input: StarInput, events: DomainEvent[]): DomainEffect[] {
  const game = next.game!;
  const consensus = consensusParticipants({ players: Object.values(next.players) });
  if (!consensus.every((player) => game.starProposal?.acceptedBy.includes(player.id))) return [];
  const decision = evaluateGameTransition(machineState(next, initiatorId, input.resolutionMs), 'star-consensus', input.now);
  if (!decision.ok || !decision.patch.lock) return [];

  const discarded = previewSettlement(next);
  game.interactionLock = decision.patch.lock;
  game.stars -= 1;
  game.starProposal = null;
  game.starResolution = { initiatorId, discarded };
  events.push({ type: 'star-used', playerId: initiatorId, discarded });
  return decision.effects;
}

function acceptCpuVotes(next: DomainMatch, events: DomainEvent[]): void {
  const proposal = next.game!.starProposal!;
  Object.values(next.players).forEach((player) => {
    if (!player.isCpu || !player.connected || proposal.acceptedBy.includes(player.id)) return;
    proposal.acceptedBy.push(player.id);
    events.push({ type: 'star-accepted', playerId: player.id });
  });
}

/** Opens a proposal and records the initiator plus connected CPU votes without mutation. */
export function proposeStar(match: DomainMatch, actorId: string, input: StarInput): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId), 'propose-star', input.now);
  if (!decision.ok) return rejected(decision.error);
  if (!match.game) return rejected('Invalid game state');
  const next = copyMatch(match);
  next.game!.starProposal = { initiatorId: actorId, acceptedBy: [actorId] };
  const events: DomainEvent[] = [{ type: 'star-proposed', playerId: actorId }];
  acceptCpuVotes(next, events);
  return succeeded(next, events, startResolution(next, actorId, input, events));
}

/** A repeated vote is a successful no-op; only a new vote can complete consensus. */
export function acceptStar(match: DomainMatch, actorId: string, input: StarInput): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId), 'accept-star', input.now);
  if (!decision.ok) return rejected(decision.error);
  if (!match.game?.starProposal) return rejected('There is no active star proposal');
  if (match.game.starProposal.acceptedBy.includes(actorId)) return succeeded(copyMatch(match));
  const next = copyMatch(match);
  const proposal = next.game!.starProposal!;
  proposal.acceptedBy.push(actorId);
  const events: DomainEvent[] = [{ type: 'star-accepted', playerId: actorId }];
  acceptCpuVotes(next, events);
  return succeeded(next, events, startResolution(next, proposal.initiatorId, input, events));
}

function clearProposal(match: DomainMatch, actorId: string, trigger: 'cancel-star' | 'reject-star', now: number): DomainResult {
  const decision = evaluateGameTransition(machineState(match, actorId), trigger, now);
  if (!decision.ok) return rejected(decision.error);
  if (!match.game?.starProposal) return rejected('There is no active star proposal');
  const next = copyMatch(match);
  next.game!.starProposal = null;
  return succeeded(next);
}

export function cancelStar(match: DomainMatch, actorId: string, now: number): DomainResult {
  return clearProposal(match, actorId, 'cancel-star', now);
}

export function rejectStar(match: DomainMatch, actorId: string, now: number): DomainResult {
  return clearProposal(match, actorId, 'reject-star', now);
}

function outcome(match: DomainMatch): 'game-over' | 'level-complete' | 'pause' {
  if (match.game!.lives <= 0) return 'game-over';
  return Object.values(match.players).every((player) => player.hand.length === 0) ? 'level-complete' : 'pause';
}

/** Applies the previously consumed preview once, only while its original star lock is current. */
export function settleStar(match: DomainMatch, actorId: string, effect: DomainEffect, input: Pick<StarInput, 'now' | 'roundFlipMs'>): DomainResult {
  const game = match.game;
  if (!game?.starResolution || effect.trigger !== 'star-settled'
    || game.phase !== effect.expected.phase
    || (game.interactionLock?.reason ?? null) !== effect.expected.lockReason
    || (game.interactionLock?.until ?? null) !== effect.expected.lockUntil) return rejected('Stale timed transition');
  const decision = evaluateGameTransition(machineState(match, actorId), 'star-settled', input.now);
  if (!decision.ok) return rejected(decision.error);

  const next = copyMatch(match);
  const nextGame = next.game!;
  nextGame.interactionLock = decision.patch.lock ?? null;
  const discarded = nextGame.starResolution!.discarded;
  discarded.forEach((entry) => {
    const hand = next.players[entry.playerId]?.hand;
    const index = hand?.indexOf(entry.card) ?? -1;
    if (hand && index !== -1) hand.splice(index, 1);
  });
  nextGame.starResolution = null;
  const resolved = outcome(next);
  const events: DomainEvent[] = [
    { type: 'star-settled', playerId: actorId, discarded },
    ...discarded.map((entry) => ({ type: 'card-discarded' as const, playerId: entry.playerId, card: entry.card, reason: 'star' as const })),
  ];
  if (resolved === 'pause') {
    const pauseActor = Object.values(next.players).find((player) => player.connected && player.hand.length > 0);
    if (!pauseActor) return rejected('Invalid game state');
    const pause = evaluateGameTransition(machineState(next, pauseActor.id), 'pause', input.now);
    if (!pause.ok) return rejected(pause.error);
    nextGame.phase = pause.patch.phase ?? nextGame.phase;
  }
  events.push({ type: 'star-outcome', outcome: resolved });
  const effects = resolved === 'level-complete'
    ? [{ type: 'schedule' as const, trigger: 'round-flip-expired', dueAt: input.now + Math.max(0, input.roundFlipMs), expected: { phase: nextGame.phase, lockReason: null, lockUntil: null } }]
    : [];
  return succeeded(next, events, effects);
}
