import { retryGame, startGame } from '../domain/setup.js';
import { pauseRound, setRoundReady } from '../domain/round.js';
import { nextCpuCard, playCard, type CardDurations } from '../domain/cards.js';
import type { DomainEffect, DomainEvent } from '../domain/result.js';
import { applyDomainResult, toDomainMatch } from './domainAdapter.js';
import type { ApplicationRoom } from './model.js';
import { dispatchApplicationResult } from './dispatcher.js';
import { applicationRejected, applicationSucceeded, type ApplicationEffect, type ApplicationEvent, type ApplicationResult } from './result.js';
import type { Clock } from './ports/clock.js';
import type { ApplicationEventPublisher } from './ports/eventPublisher.js';
import type { RandomSource } from './ports/randomSource.js';
import type { RoomRepository } from './ports/roomRepository.js';
import type { Scheduler } from './ports/scheduler.js';

export type GameUseCaseDependencies = {
  rooms: RoomRepository;
  publisher: ApplicationEventPublisher;
  scheduler: Scheduler;
  clock: Clock;
  random: RandomSource;
  dealingDuration: (level: number) => number;
  countdownDuration: () => number;
  retryBannerMs: number;
  cardDurations: () => CardDurations;
  cpuDelay: () => number;
};

export type GameCommand = { roomCode: string; playerId: string };

function shuffledDeck(random: RandomSource): number[] {
  const deck = Array.from({ length: 100 }, (_, index) => index + 1);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random.next() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

export function applicationEffects(roomCode: string, expectedVersion: number, effects: readonly DomainEffect[]): ApplicationEffect[] {
  return effects.map((effect) => ({ ...effect, roomCode, expectedVersion }));
}

/** Translates committed domain facts without deriving card, outcome, or reward rules. */
export function cardEvents(roomCode: string, events: readonly DomainEvent[]): ApplicationEvent[] {
  const translated: ApplicationEvent[] = [];
  for (const event of events) {
    if (event.type === 'card-played') translated.push({ type: 'game-card-played', roomCode, playerId: event.playerId, card: event.card });
    if (event.type === 'error-penalty') translated.push({ type: 'game-error-penalty', roomCode, playerId: event.playerId, card: event.card, blockingCards: event.blockingCards, lifeLost: event.lifeLost });
    if (event.type === 'card-discarded') translated.push({ type: 'game-card-discarded', roomCode, playerId: event.playerId, card: event.card, reason: event.reason });
    if (event.type === 'level-completed') translated.push({ type: 'game-level-completed', roomCode, level: event.level, reward: event.reward });
    if (event.type === 'reward-applied') translated.push({ type: 'game-reward-applied', roomCode, reward: event.reward });
    if (event.type === 'next-level-ready') translated.push({ type: 'game-next-level-ready', roomCode, level: event.level });
    if (event.type === 'game-over') translated.push({ type: 'game-over', roomCode, reason: 'No lives left' });
    if (event.type === 'victory') translated.push({ type: 'game-victory', roomCode });
  }
  return translated;
}

function errorCode(message: string): 'forbidden' | 'invalid-state' {
  return message.startsWith('Only the host') ? 'forbidden' : 'invalid-state';
}

/** Socket-free owner of start and retry, including deterministic deck construction. */
export class GameUseCases {
  constructor(private readonly dependencies: GameUseCaseDependencies) {}

  startGame(command: GameCommand): ApplicationResult<{ room: ApplicationRoom; startedAt: number }> {
    return this.execute(command, 'start');
  }

  retryGame(command: GameCommand): ApplicationResult<{ room: ApplicationRoom; startedAt: number }> {
    return this.execute(command, 'retry');
  }

  /** Executes a human or development-CPU card command through the same domain path. */
  playCard(command: GameCommand & { card: number }): ApplicationResult<{ room: ApplicationRoom }> {
    return executePlayCard(this.dependencies, command);
  }

  /** Commits the domain's ready decision and lets the dispatcher replace countdown work by key. */
  setPlayerReady(command: GameCommand & { ready: boolean }): ApplicationResult<{ room: ApplicationRoom }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    if (!room || !room.players[command.playerId]) return applicationRejected('not-found', 'You are not in a room');

    const expectedVersion = room.version;
    const result = setRoundReady(toDomainMatch(room), command.playerId, command.ready, {
      now: this.dependencies.clock.now(),
      countdownMs: this.dependencies.countdownDuration(),
    });
    if (!result.ok) return applicationRejected('invalid-state', result.error);
    const applied = applyDomainResult(room, result);
    if (!applied.applied) return applicationRejected('invalid-state', 'Invalid game state');
    const saved = this.dependencies.rooms.save(room, expectedVersion);
    const effects = applicationEffects(saved.code, saved.version, applied.effects);
    return dispatchApplicationResult(
      applicationSucceeded(
        { room: saved },
        [{ type: 'room-saved', room: saved, expectedVersion }],
        [{ type: 'room-updated', roomCode: saved.code }],
        effects,
      ),
      this.dependencies.publisher,
      this.dependencies.scheduler,
    );
  }

  /** Manual pause alone produces the requested-pause event; automatic pauses never use it. */
  requestPause(command: GameCommand): ApplicationResult<{ room: ApplicationRoom }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    if (!room || !room.players[command.playerId] || !room.game) return applicationRejected('invalid-state', 'Invalid game state');

    const expectedVersion = room.version;
    const result = pauseRound(toDomainMatch(room), command.playerId, this.dependencies.clock.now());
    if (!result.ok) return applicationRejected('invalid-state', result.error);
    const applied = applyDomainResult(room, result);
    if (!applied.applied) return applicationRejected('invalid-state', 'Invalid game state');
    const saved = this.dependencies.rooms.save(room, expectedVersion);
    const requested = applied.events.find((event) => event.type === 'round-pause-requested');
    if (!requested) return applicationRejected('invalid-state', 'Invalid game state');
    return dispatchApplicationResult(
      applicationSucceeded(
        { room: saved },
        [{ type: 'room-saved', room: saved, expectedVersion }],
        [{ type: 'game-paused', roomCode: saved.code, playerId: requested.playerId }],
      ),
      this.dependencies.publisher,
      this.dependencies.scheduler,
    );
  }

  private execute(command: GameCommand, action: 'start' | 'retry'): ApplicationResult<{ room: ApplicationRoom; startedAt: number }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    if (!room || !room.players[command.playerId]) return applicationRejected('not-found', 'You are not in a room');

    const startedAt = this.dependencies.clock.now();
    const result = action === 'start'
      ? startGame(toDomainMatch(room), command.playerId, {
        now: startedAt,
        deck: () => shuffledDeck(this.dependencies.random),
        dealingMs: this.dependencies.dealingDuration(1),
      })
      : retryGame(toDomainMatch(room), command.playerId, {
        now: startedAt,
        deck: () => shuffledDeck(this.dependencies.random),
        dealingMs: this.dependencies.dealingDuration(1),
        retryBannerMs: this.dependencies.retryBannerMs,
      });
    if (!result.ok) return applicationRejected(errorCode(result.error), result.error);

    const applied = applyDomainResult(room, result);
    if (!applied.applied) return applicationRejected('invalid-state', 'Invalid game state');
    const saved = this.dependencies.rooms.save(room, room.version);
    const effects = applicationEffects(saved.code, saved.version, applied.effects);
    const event = action === 'start'
      ? { type: 'game-started' as const, roomCode: saved.code, startedAt }
      : { type: 'game-restarted' as const, roomCode: saved.code, playerId: command.playerId, startedAt };
    return dispatchApplicationResult(
      applicationSucceeded(
        { room: saved, startedAt },
        [{ type: 'room-saved', room: saved, expectedVersion: room.version }],
        [event],
        effects,
        action === 'retry' ? [{ type: 'cancel-room', roomCode: saved.code }] : [],
      ),
      this.dependencies.publisher,
      this.dependencies.scheduler,
    );
  }
}

/** Shared card command implementation so timed CPU work cannot bypass the game owner. */
export function executePlayCard(dependencies: GameUseCaseDependencies, command: GameCommand & { card: number }): ApplicationResult<{ room: ApplicationRoom }> {
  const room = dependencies.rooms.get(command.roomCode);
  if (!room || !room.players[command.playerId]) return applicationRejected('not-found', 'You are not in a room');
  const expectedVersion = room.version;
  const result = playCard(toDomainMatch(room), command.playerId, command.card, dependencies.clock.now(), dependencies.cardDurations());
  if (!result.ok) return applicationRejected('invalid-state', result.error);
  const applied = applyDomainResult(room, result);
  if (!applied.applied) return applicationRejected('invalid-state', 'Invalid game state');
  const saved = dependencies.rooms.save(room, expectedVersion);
  const effects = applicationEffects(saved.code, saved.version, applied.effects);
  const shouldContinue = applied.events.some((event) => event.type === 'card-played')
    && !applied.events.some((event) => event.type === 'error-penalty')
    && !effects.some((effect) => effect.trigger === 'round-flip-expired');
  if (shouldContinue && nextCpuCard(toDomainMatch(saved))) {
    const game = saved.game!;
    effects.push({
      type: 'schedule', trigger: 'cpu-turn', dueAt: dependencies.clock.now() + Math.max(0, dependencies.cpuDelay()),
      expected: { phase: game.phase, lockReason: game.interactionLock?.reason ?? null, lockUntil: game.interactionLock?.until ?? null },
      roomCode: saved.code, expectedVersion: saved.version,
    });
  }
  return dispatchApplicationResult(
    applicationSucceeded(
      { room: saved },
      [{ type: 'room-saved', room: saved, expectedVersion }],
      [...cardEvents(saved.code, applied.events), { type: 'room-updated', roomCode: saved.code }],
      effects,
    ),
    dependencies.publisher,
    dependencies.scheduler,
  );
}

export { shuffledDeck };
