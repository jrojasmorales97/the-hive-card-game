import { expireCardEffect, nextCpuCard, type CardDurations } from '../domain/cards.js';
import { readyParticipants } from '../domain/participants.js';
import { advanceLevel, completeLevel, expireProgressionEffect, finishGame } from '../domain/progression.js';
import { expireRoundEffect, setRoundReady } from '../domain/round.js';
import { settleStar } from '../domain/star.js';
import type { DomainEffect, DomainEvent, DomainResult } from '../domain/result.js';
import { applyDomainResult, toDomainMatch } from './domainAdapter.js';
import { applicationEffects, cardEvents, executePlayCard, shuffledDeck, type GameUseCaseDependencies } from './gameUseCases.js';
import { dispatchApplicationResult } from './dispatcher.js';
import { applicationRejected, applicationSucceeded, type ApplicationEffect, type ApplicationEvent, type ApplicationResult } from './result.js';
import type { Clock } from './ports/clock.js';
import type { ApplicationEventPublisher } from './ports/eventPublisher.js';
import type { RandomSource } from './ports/randomSource.js';
import type { RoomRepository } from './ports/roomRepository.js';
import type { Scheduler } from './ports/scheduler.js';

export type EffectUseCaseDependencies = {
  rooms: RoomRepository;
  publisher: ApplicationEventPublisher;
  scheduler: Scheduler;
  clock: Clock;
  random: RandomSource;
  countdownMs: number;
  cardDurations: () => CardDurations;
  levelCompleteMs: () => number;
  dealingDuration: (level: number) => number;
  cpuDelay: () => number;
  retryBannerMs: number;
};

type Accepted = Extract<DomainResult, { ok: true }>;

function accepted(state: Accepted['state'], events: DomainEvent[] = [], effects: DomainEffect[] = []): Accepted {
  return { ok: true, state, events, effects };
}

/** Re-enters each declared domain effect once; version and domain expectations make stale work a no-op. */
export class EffectUseCases {
  constructor(private readonly dependencies: EffectUseCaseDependencies) {}

  materialize(effect: ApplicationEffect): ApplicationResult<{ roomCode: string }> {
    const room = this.dependencies.rooms.get(effect.roomCode);
    if (!room) return applicationRejected('not-found', 'That room does not exist');
    if (room.version !== effect.expectedVersion) return applicationRejected('conflict', 'Stale timed transition');
    if (effect.trigger === 'star-settled') return this.materializeStarSettlement(room, effect);
    const actor = room.players[room.hostId];
    if (!actor) return applicationRejected('invalid-state', 'Invalid game state');

    if (effect.trigger === 'cpu-turn') {
      const cpu = nextCpuCard(toDomainMatch(room));
      if (!cpu) return applicationRejected('invalid-state', 'Stale timed transition');
      const played = executePlayCard(this.gameDependencies(), { roomCode: room.code, playerId: cpu.playerId, card: cpu.card });
      if (!played.ok) return played;
      return applicationSucceeded({ roomCode: room.code }, played.changes, played.events, played.effects);
    }

    const resolved = this.resolveDomainEffect(room.code, actor.id, effect);
    if (!resolved.ok) return applicationRejected('invalid-state', resolved.error);
    const expectedVersion = room.version;
    const applied = applyDomainResult(room, resolved);
    if (!applied.applied) return applicationRejected('invalid-state', 'Invalid game state');
    const saved = this.dependencies.rooms.save(room, expectedVersion);
    const effects = applicationEffects(saved.code, saved.version, applied.effects);
    if (effect.trigger === 'countdown-expired' && nextCpuCard(toDomainMatch(saved))) {
      const game = saved.game!;
      effects.push({
        type: 'schedule', trigger: 'cpu-turn', dueAt: this.dependencies.clock.now() + Math.max(0, this.dependencies.cpuDelay()),
        expected: { phase: game.phase, lockReason: game.interactionLock?.reason ?? null, lockUntil: game.interactionLock?.until ?? null },
        roomCode: saved.code, expectedVersion: saved.version,
      });
    }
    const events = this.applicationEvents(saved.code, applied.events, effect.trigger);
    return dispatchApplicationResult(
      applicationSucceeded(
        { roomCode: saved.code },
        [{ type: 'room-saved', room: saved, expectedVersion }],
        events,
        effects,
      ),
      this.dependencies.publisher,
      this.dependencies.scheduler,
    );
  }

  /** The deadline and every visual acknowledgement reach this single settlement path. */
  private materializeStarSettlement(room: import('./model.js').ApplicationRoom, effect: ApplicationEffect): ApplicationResult<{ roomCode: string }> {
    const wait = room.starSettlement;
    if (!wait || !room.players[room.hostId]) return applicationRejected('invalid-state', 'Stale timed transition');
    const allAcknowledged = wait.awaitingPlayerIds.every((playerId) => wait.acknowledgedPlayerIds.includes(playerId));
    const now = this.dependencies.clock.now();
    if (!allAcknowledged && now < wait.effect.dueAt) return applicationRejected('invalid-state', 'Stale timed transition');

    const expectedVersion = room.version;
    const resolved = settleStar(toDomainMatch(room), room.hostId, wait.effect, {
      now,
      roundFlipMs: this.dependencies.cardDurations().roundFlipMs,
    });
    if (!resolved.ok) return applicationRejected('invalid-state', resolved.error);
    const applied = applyDomainResult(room, resolved);
    if (!applied.applied) return applicationRejected('invalid-state', 'Invalid game state');
    room.starSettlement = null;
    const saved = this.dependencies.rooms.save(room, expectedVersion);
    const events = [...cardEvents(saved.code, applied.events), { type: 'room-updated' as const, roomCode: saved.code }];
    return dispatchApplicationResult(
      applicationSucceeded(
        { roomCode: saved.code },
        [{ type: 'room-saved', room: saved, expectedVersion }],
        events,
        applicationEffects(saved.code, saved.version, applied.effects),
      ),
      this.dependencies.publisher,
      this.dependencies.scheduler,
    );
  }

  private resolveDomainEffect(roomCode: string, actorId: string, effect: ApplicationEffect): DomainResult {
    const room = this.dependencies.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'That room does not exist' };
    const state = toDomainMatch(room);
    const now = this.dependencies.clock.now();
    if (effect.trigger === 'dealing-expired' || effect.trigger === 'countdown-expired') {
      return expireRoundEffect(state, actorId, effect, now, this.dependencies.countdownMs);
    }
    if (effect.trigger === 'error-expired' || effect.trigger === 'round-flip-expired' || effect.trigger === 'round-unflip-expired') {
      const first = expireCardEffect(state, actorId, effect, now, this.dependencies.cardDurations());
      if (!first.ok) return first;
      return this.resolveCardOutcome(first, actorId, now);
    }
    if (effect.trigger === 'next-level-expired') {
      return advanceLevel(state, actorId, effect, {
        now,
        deck: shuffledDeck(this.dependencies.random),
        levelCompleteMs: this.dependencies.levelCompleteMs(),
        dealingMs: this.dependencies.dealingDuration((state.game?.currentLevel ?? 0) + 1),
      });
    }
    if (effect.trigger === 'level-ready-expired') {
      const released = expireProgressionEffect(state, actorId, effect, now);
      if (!released.ok) return released;
      const participant = readyParticipants({ players: Object.values(released.state.players) })[0];
      if (!participant) return released;
      const continued = setRoundReady(released.state, participant.id, participant.ready, { now, countdownMs: this.dependencies.countdownMs });
      if (!continued.ok) return continued;
      return accepted(continued.state, [...released.events, ...continued.events], [...released.effects, ...continued.effects]);
    }
    return { ok: false, error: 'Stale timed transition' };
  }

  private resolveCardOutcome(first: Accepted, actorId: string, now: number): DomainResult {
    const outcome = first.events.find((event): event is Extract<DomainEvent, { type: 'card-outcome' }> => event.type === 'card-outcome');
    if (!outcome) return first;
    if (outcome.outcome === 'pause') return first;
    const terminal = outcome.outcome === 'game-over'
      ? finishGame(first.state, actorId, 'game-over', now)
      : completeLevel(first.state, actorId, { now, completedAt: now });
    if (!terminal.ok) return terminal;
    return accepted(terminal.state, [...first.events, ...terminal.events], [...first.effects, ...terminal.effects]);
  }

  private applicationEvents(roomCode: string, events: readonly DomainEvent[], trigger: string): ApplicationEvent[] {
    const translated = cardEvents(roomCode, events);
    if (trigger === 'next-level-expired') return translated;
    if (translated.some((event) => event.type === 'game-over')) return translated;
    return [...translated, { type: 'room-updated', roomCode }];
  }

  private gameDependencies(): GameUseCaseDependencies {
    return {
      rooms: this.dependencies.rooms,
      publisher: this.dependencies.publisher,
      scheduler: this.dependencies.scheduler,
      clock: this.dependencies.clock,
      random: this.dependencies.random,
      dealingDuration: this.dependencies.dealingDuration,
      countdownDuration: () => this.dependencies.countdownMs,
      retryBannerMs: this.dependencies.retryBannerMs,
      cardDurations: this.dependencies.cardDurations,
      cpuDelay: this.dependencies.cpuDelay,
    };
  }
}
