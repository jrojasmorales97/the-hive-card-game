import { resolveRoomJoin, validateLobbyKickRequest } from '../domain/room.js';
import type { ApplicationRoom, ApplicationPlayer } from './model.js';
import { applicationRejected, applicationSucceeded, type ApplicationEvent, type ApplicationResult } from './result.js';
import { dispatchApplicationResult } from './dispatcher.js';
import type { RoomRepository } from './ports/roomRepository.js';
import type { ApplicationEventPublisher } from './ports/eventPublisher.js';
import type { Scheduler } from './ports/scheduler.js';
import type { RandomSource } from './ports/randomSource.js';

const MAX_PLAYERS = 8;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const copy = <T>(value: T): T => structuredClone(value);

export type RoomUseCaseDependencies = { rooms: RoomRepository; publisher: ApplicationEventPublisher; scheduler: Scheduler; random: RandomSource };
export type CreateRoomCommand = { playerId: string; playerName: string };
export type JoinRoomCommand = { roomCode: string; playerId: string; playerName: string };
export type PlayerRoomCommand = { roomCode: string; playerId: string };

/** Socket-free room, reconnection, resync and presence orchestration. */
export class RoomUseCases {
  constructor(private readonly dependencies: RoomUseCaseDependencies) {}

  private complete<T>(result: ApplicationResult<T>): ApplicationResult<T> {
    return dispatchApplicationResult(result, this.dependencies.publisher, this.dependencies.scheduler);
  }

  private code(): string {
    let code = '';
    do { code = Array.from({ length: 6 }, () => alphabet[Math.floor(this.dependencies.random.next() * alphabet.length)]).join(''); } while (this.dependencies.rooms.has(code));
    return code;
  }

  createRoom(command: CreateRoomCommand): ApplicationResult<{ room: ApplicationRoom; playerId: string }> {
    if (!command.playerId || !command.playerName.trim()) return applicationRejected('invalid-input', 'Invalid player name or identifier');
    const code = this.code();
    const player: ApplicationPlayer = { id: command.playerId, name: command.playerName.trim(), connected: true, ready: false, hand: [] };
    const room: ApplicationRoom = { code, displayCode: code, shareable: true, hostId: player.id, status: 'lobby', players: { [player.id]: player }, game: null, version: 0, logs: [] };
    const saved = this.dependencies.rooms.save(room, 0);
    return this.complete(applicationSucceeded({ room: saved, playerId: player.id }, [{ type: 'room-created', room: saved }], [{ type: 'room-joined', roomCode: code, playerId: player.id, playerName: player.name }]));
  }

  joinRoom(command: JoinRoomCommand): ApplicationResult<{ room: ApplicationRoom; reconnected: boolean }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    if (!room) return applicationRejected('not-found', 'That room does not exist');
    if (!command.playerId || !command.playerName.trim()) return applicationRejected('invalid-input', 'Invalid room code, name, or identifier');
    const existing = room.players[command.playerId];
    const decision = resolveRoomJoin({ roomStatus: room.status, existingPlayer: Boolean(existing) });
    if (!decision.ok) return applicationRejected('invalid-state', decision.error);
    if (!existing && Object.keys(room.players).length >= MAX_PLAYERS) return applicationRejected('room-full', `Room is full (maximum ${MAX_PLAYERS} players)`);
    const next = copy(room);
    if (existing) { next.players[command.playerId] = { ...existing, name: command.playerName.trim(), connected: true }; }
    else next.players[command.playerId] = { id: command.playerId, name: command.playerName.trim(), connected: true, ready: false, hand: [] };
    if (!existing && room.shareable === false && Object.values(room.players).every((player) => player.isCpu)) {
      next.hostId = command.playerId;
    }
    const saved = this.dependencies.rooms.save(next, room.version);
    const event = { type: existing ? 'room-reconnected' as const : 'room-joined' as const, roomCode: saved.code, playerId: command.playerId, playerName: saved.players[command.playerId].name };
    return this.complete(applicationSucceeded({ room: saved, reconnected: Boolean(existing) }, [{ type: 'room-saved', room: saved, expectedVersion: room.version }], [event]));
  }

  reconnectPlayer(command: JoinRoomCommand): ApplicationResult<{ room: ApplicationRoom; reconnected: true }> {
    const outcome = this.joinRoom(command);
    if (!outcome.ok) return outcome;
    return outcome.data.reconnected
      ? { ...outcome, data: { room: outcome.data.room, reconnected: true } }
      : applicationRejected('invalid-state', 'That player is no longer in the room');
  }

  resyncRoom(command: PlayerRoomCommand): ApplicationResult<{ room: ApplicationRoom; player: ApplicationPlayer }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    const player = room?.players[command.playerId];
    if (!room || !player) return applicationRejected('not-found', 'You are not in a room');
    return this.complete(applicationSucceeded({ room, player: copy(player) }));
  }

  leaveRoom(command: PlayerRoomCommand): ApplicationResult<{ deleted: boolean; room: ApplicationRoom | null }> {
    return this.remove(command, undefined);
  }

  kickPlayer(command: PlayerRoomCommand & { targetPlayerId: string | null | undefined }): ApplicationResult<{ deleted: boolean; room: ApplicationRoom | null; target: ApplicationPlayer }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    if (!room) return applicationRejected('not-found', 'You are not in a room');
    const decision = validateLobbyKickRequest({ isHost: room.hostId === command.playerId, roomStatus: room.status, actorId: command.playerId, targetId: command.targetPlayerId, targetExists: Boolean(command.targetPlayerId && room.players[command.targetPlayerId]) });
    if (!decision.ok) return applicationRejected('forbidden', decision.error);
    const target = copy(room.players[command.targetPlayerId!]);
    const outcome = this.remove({ roomCode: command.roomCode, playerId: target.id }, command.playerId, [{ type: 'room-kicked', roomCode: command.roomCode, playerId: target.id }]);
    if (!outcome.ok) return outcome;
    return { ...outcome, data: { ...outcome.data, target } };
  }

  disconnectPlayer(command: PlayerRoomCommand): ApplicationResult<{ room: ApplicationRoom }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    const player = room?.players[command.playerId];
    if (!room || !player) return applicationRejected('not-found', 'You are not in a room');
    const next = copy(room);
    next.players[player.id] = { ...player, connected: false, ready: false };
    if (next.hostId === player.id) next.hostId = Object.values(next.players).find((entry) => entry.connected)?.id ?? Object.keys(next.players)[0];
    const saved = this.dependencies.rooms.save(next, room.version);
    return this.complete(applicationSucceeded({ room: saved }, [{ type: 'room-saved', room: saved, expectedVersion: room.version }, { type: 'player-presence-changed', roomCode: saved.code, playerId: player.id, connected: false }], [{ type: 'room-disconnected', roomCode: saved.code, playerId: player.id, playerName: player.name }]));
  }

  private remove(command: PlayerRoomCommand, removedBy: string | undefined, leadingEvents: ApplicationEvent[] = []): ApplicationResult<{ deleted: boolean; room: ApplicationRoom | null }> {
    const room = this.dependencies.rooms.get(command.roomCode);
    const player = room?.players[command.playerId];
    if (!room || !player) return applicationRejected('not-found', 'You are not in a room');
    const next = copy(room);
    delete next.players[player.id];
    if (Object.keys(next.players).length === 0) {
      this.dependencies.rooms.delete(room.code);
      return this.complete(applicationSucceeded(
        { deleted: true, room: null },
        [{ type: 'room-deleted', roomCode: room.code }],
        [...leadingEvents, { type: 'room-left', roomCode: room.code, playerId: player.id, playerName: player.name }],
        [],
        [{ type: 'cancel-room', roomCode: room.code }],
      ));
    }
    if (Object.values(next.players).every((entry) => entry.isCpu)) {
      next.status = 'lobby';
      next.game = null;
      Object.values(next.players).forEach((entry) => { entry.hand = []; entry.connected = true; entry.ready = true; });
      next.hostId = Object.values(next.players).find((entry) => entry.isCpu)?.id ?? next.hostId;
    }
    if (next.game?.starProposal) {
      const proposal = next.game.starProposal;
      if (proposal.initiatorId === player.id) next.game.starProposal = null;
      else if (Array.isArray(proposal.acceptedBy)) proposal.acceptedBy = proposal.acceptedBy.filter((id) => id !== player.id);
      else (proposal.acceptedBy as unknown as Set<string>).delete(player.id);
    }
    if (next.hostId === player.id) next.hostId = Object.values(next.players).find((entry) => entry.connected)?.id ?? Object.keys(next.players)[0];
    const saved = this.dependencies.rooms.save(next, room.version);
    const events: ApplicationEvent[] = [...leadingEvents];
    if (saved.hostId !== room.hostId) events.push({ type: 'room-host-changed', roomCode: saved.code, fromPlayerId: room.hostId, toPlayerId: saved.hostId });
    events.push({ type: 'room-left', roomCode: saved.code, playerId: player.id, playerName: player.name });
    void removedBy;
    return this.complete(applicationSucceeded({ deleted: false, room: saved }, [{ type: 'room-saved', room: saved, expectedVersion: room.version }], events));
  }
}
