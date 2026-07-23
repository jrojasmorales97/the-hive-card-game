import { nextCpuCard } from '../domain/cards.js';
import { acceptStar, cancelStar, proposeStar, rejectStar, type StarInput } from '../domain/star.js';
import type { DomainEffect, DomainEvent, DomainResult } from '../domain/result.js';
import { applyDomainResult, toDomainMatch } from './domainAdapter.js';
import { dispatchApplicationResult } from './dispatcher.js';
import type { ApplicationRoom, StarSettlementWait } from './model.js';
import { applicationRejected, applicationSucceeded, type ApplicationEffect, type ApplicationEvent, type ApplicationResult } from './result.js';
import { applicationEffects } from './gameUseCases.js';
import type { Clock } from './ports/clock.js';
import type { ApplicationEventPublisher } from './ports/eventPublisher.js';
import type { RoomRepository } from './ports/roomRepository.js';
import type { Scheduler } from './ports/scheduler.js';

export type StarUseCaseDependencies = {
  rooms: RoomRepository;
  publisher: ApplicationEventPublisher;
  scheduler: Scheduler;
  clock: Clock;
  resolutionMs: () => number;
  roundFlipMs: () => number;
  cpuDelay: () => number;
};

export type StarCommand = { roomCode: string; playerId: string };
type StarAction = 'propose' | 'accept' | 'cancel' | 'reject';

function starEvents(roomCode: string, events: readonly DomainEvent[]): ApplicationEvent[] {
  const translated: ApplicationEvent[] = [];
  for (const event of events) {
    if (event.type === 'star-proposed') translated.push({ type: 'game-star-proposed', roomCode, playerId: event.playerId });
    if (event.type === 'star-accepted') translated.push({ type: 'game-star-accepted', roomCode, playerId: event.playerId });
    if (event.type === 'star-used') translated.push({ type: 'game-star-used', roomCode, playerId: event.playerId, discarded: event.discarded });
  }
  return translated;
}

function error(result: DomainResult): ApplicationResult<never> {
  return applicationRejected('invalid-state', result.ok ? 'Invalid game state' : result.error);
}

/** Socket-free owner of proposal, voting, visual acknowledgement and cancellation. */
export class StarUseCases {
  constructor(private readonly dependencies: StarUseCaseDependencies) {}

  proposeStar(command: StarCommand): ApplicationResult<{ room: ApplicationRoom }> {
    return this.execute(command, 'propose');
  }

  acceptStar(command: StarCommand): ApplicationResult<{ room: ApplicationRoom }> {
    return this.execute(command, 'accept');
  }

  cancelStar(command: StarCommand): ApplicationResult<{ room: ApplicationRoom }> {
    return this.execute(command, 'cancel');
  }

  rejectStar(command: StarCommand): ApplicationResult<{ room: ApplicationRoom }> {
    return this.execute(command, 'reject');
  }

  /**
   * Records one visual completion by stable identity. A duplicate, an actor
   * outside the pending population, or a stale callback is intentionally a
   * successful no-op: it cannot consume the domain settlement twice.
   */
  completeStarAnimation(command: StarCommand): ApplicationResult<{ room: ApplicationRoom | null; settled: boolean }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    if (!room) return applicationRejected('not-found', 'That room does not exist');
    const wait = room.starSettlement;
    if (!wait || !wait.awaitingPlayerIds.includes(command.playerId) || wait.acknowledgedPlayerIds.includes(command.playerId)) {
      return applicationSucceeded({ room, settled: false });
    }

    const acknowledgedPlayerIds = [...wait.acknowledgedPlayerIds, command.playerId];
    const settled = wait.awaitingPlayerIds.every((playerId) => acknowledgedPlayerIds.includes(playerId));
    const next = structuredClone(room);
    next.starSettlement = { ...wait, acknowledgedPlayerIds };
    const saved = this.dependencies.rooms.save(next, room.version);
    const effect = this.pendingEffect(saved, settled);
    return dispatchApplicationResult(
      applicationSucceeded(
        { room: saved, settled },
        [{ type: 'room-saved', room: saved, expectedVersion: room.version }],
        [],
        [effect],
      ),
      this.dependencies.publisher,
      this.dependencies.scheduler,
    );
  }

  private execute(command: StarCommand, action: StarAction): ApplicationResult<{ room: ApplicationRoom }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    if (!room || !room.players[command.playerId] || !room.game) return applicationRejected('invalid-state', 'Invalid game state');
    const now = this.dependencies.clock.now();
    const input: StarInput = { now, resolutionMs: this.dependencies.resolutionMs(), roundFlipMs: this.dependencies.roundFlipMs() };
    const result = action === 'propose' ? proposeStar(toDomainMatch(room), command.playerId, input)
      : action === 'accept' ? acceptStar(toDomainMatch(room), command.playerId, input)
        : action === 'cancel' ? cancelStar(toDomainMatch(room), command.playerId, now)
          : rejectStar(toDomainMatch(room), command.playerId, now);
    if (!result.ok) return error(result);

    const expectedVersion = room.version;
    const applied = applyDomainResult(room, result);
    if (!applied.applied) return applicationRejected('invalid-state', 'Invalid game state');
    const used = applied.events.find((event): event is Extract<DomainEvent, { type: 'star-used' }> => event.type === 'star-used');
    if (used) {
      const original = applied.effects.find((effect) => effect.trigger === 'star-settled');
      if (!original) return applicationRejected('invalid-state', 'Invalid game state');
      room.starSettlement = this.waitFor(room, used.discarded, original);
      this.dependencies.scheduler.cancel(room.code, 'cpu-turn');
    }
    const saved = this.dependencies.rooms.save(room, expectedVersion);
    const events = starEvents(saved.code, applied.events);
    const effects = applicationEffects(saved.code, saved.version, applied.effects);
    if (used) {
      const wait = saved.starSettlement!;
      const settlement = this.pendingEffect(saved, wait.awaitingPlayerIds.length === 0);
      const index = effects.findIndex((effect) => effect.trigger === 'star-settled');
      if (index >= 0) effects[index] = settlement;
    } else {
      events.push({ type: 'room-updated', roomCode: saved.code });
      if ((action === 'cancel' || action === 'reject') && nextCpuCard(toDomainMatch(saved))) effects.push(this.cpuEffect(saved));
    }
    return dispatchApplicationResult(
      applicationSucceeded({ room: saved }, [{ type: 'room-saved', room: saved, expectedVersion }], events, effects),
      this.dependencies.publisher,
      this.dependencies.scheduler,
    );
  }

  private waitFor(room: ApplicationRoom, discarded: Extract<DomainEvent, { type: 'star-used' }>['discarded'], effect: DomainEffect): StarSettlementWait {
    return {
      effect: structuredClone(effect),
      awaitingPlayerIds: discarded
        .map((entry) => room.players[entry.playerId])
        .filter((player): player is NonNullable<typeof player> => Boolean(player && player.connected && !player.isCpu))
        .map((player) => player.id),
      acknowledgedPlayerIds: [],
    };
  }

  private pendingEffect(room: ApplicationRoom, settleNow: boolean): ApplicationEffect {
    const wait = room.starSettlement!;
    return { ...wait.effect, roomCode: room.code, expectedVersion: room.version, dueAt: settleNow ? this.dependencies.clock.now() : wait.effect.dueAt };
  }

  private cpuEffect(room: ApplicationRoom): ApplicationEffect {
    const game = room.game!;
    return {
      type: 'schedule', trigger: 'cpu-turn', dueAt: this.dependencies.clock.now() + Math.max(0, this.dependencies.cpuDelay()),
      expected: { phase: game.phase, lockReason: game.interactionLock?.reason ?? null, lockUntil: game.interactionLock?.until ?? null },
      roomCode: room.code, expectedVersion: room.version,
    };
  }
}
