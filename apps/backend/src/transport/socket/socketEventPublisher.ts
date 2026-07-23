import type { GameLogEvent, GameLogType, ServerToClientEvents, ClientToServerEvents } from '@the-hive/contracts';
import type { Server } from 'socket.io';
import type { ApplicationRoom } from '../../application/model.js';
import type { ApplicationEvent } from '../../application/result.js';
import type { ApplicationEventPublisher } from '../../application/ports/eventPublisher.js';
import { RoomPresenter } from './roomPresenter.js';
import { SessionRegistry } from './sessionRegistry.js';

type RuntimeRoom = Omit<ApplicationRoom, 'logs'> & { logs: GameLogEvent[] };

/** Publishes committed room events once, in application order, through safe public/private presenters. */
export class SocketEventPublisher implements ApplicationEventPublisher {
  private logSequence = 0;
  constructor(
    private readonly io: Server<ClientToServerEvents, ServerToClientEvents>,
    private readonly rooms: (roomCode: string) => RuntimeRoom | undefined,
    private readonly sessions: SessionRegistry,
    private readonly presenter: RoomPresenter,
    private readonly now: () => number,
  ) {}

  emitRoomUpdate(roomCode: string, incrementVersion = true): void {
    const room = this.rooms(roomCode);
    if (!room) return;
    if (incrementVersion) room.version += 1;
    const serverTime = this.now();
    this.io.to(roomCode).emit('room:update', this.presenter.publicEnvelope(room, serverTime));
    for (const player of Object.values(room.players)) {
      const socketId = this.sessions.socketIdForPlayer(player.id);
      if (!socketId) continue;
      this.io.to(socketId).emit('player:state', this.presenter.privateEnvelope(room, player, serverTime));
      this.io.to(socketId).emit('room:snapshot', this.presenter.snapshot(room, player, serverTime));
    }
  }

  emitGameLog(roomCode: string, type: GameLogType, payload: Record<string, unknown> = {}): void {
    const timestamp = this.now();
    const entry: GameLogEvent = { id: `${timestamp}-${++this.logSequence}`, ts: timestamp, roomCode, type, payload };
    const room = this.rooms(roomCode);
    if (room) {
      room.logs.push(entry);
      if (room.logs.length > 50) room.logs = room.logs.slice(-50);
    }
    this.io.to(roomCode).emit('game:log', entry);
  }

  publish(event: ApplicationEvent): void {
    switch (event.type) {
      case 'room-joined':
        this.emitRoomUpdate(event.roomCode, false);
        this.emitGameLog(event.roomCode, 'room:joined', { playerId: event.playerId, playerName: event.playerName });
        return;
      case 'room-reconnected':
        this.emitRoomUpdate(event.roomCode, false);
        this.emitGameLog(event.roomCode, 'room:reconnected', { playerId: event.playerId, playerName: event.playerName });
        return;
      case 'room-host-changed': {
        const room = this.rooms(event.roomCode);
        this.emitGameLog(event.roomCode, 'room:host-changed', {
          fromPlayerId: event.fromPlayerId,
          toPlayerId: event.toPlayerId,
          toPlayerName: room?.players[event.toPlayerId]?.name ?? 'Jugador',
        });
        return;
      }
      case 'room-kicked': {
        const socketId = this.sessions.socketIdForPlayer(event.playerId);
        if (socketId) {
          this.io.to(socketId).emit('room:kicked', { roomCode: event.roomCode, message: 'The host removed you from the room.' });
          void this.io.sockets.sockets.get(socketId)?.leave(event.roomCode);
        }
        this.sessions.removePlayer(event.playerId);
        return;
      }
      case 'room-left': {
        const socketId = this.sessions.socketIdForPlayer(event.playerId);
        if (socketId) void this.io.sockets.sockets.get(socketId)?.leave(event.roomCode);
        this.sessions.removePlayer(event.playerId);
        this.emitRoomUpdate(event.roomCode, false);
        this.emitGameLog(event.roomCode, 'room:left', { playerId: event.playerId, playerName: event.playerName });
        return;
      }
      case 'room-disconnected':
        this.emitRoomUpdate(event.roomCode, false);
        this.emitGameLog(event.roomCode, 'room:left', { playerId: event.playerId, playerName: event.playerName, reason: 'disconnect' });
        return;
      case 'room-resynced':
        return;
      case 'room-updated':
        this.emitRoomUpdate(event.roomCode, false);
        return;
      case 'game-started': {
        const room = this.rooms(event.roomCode);
        if (!room) return;
        this.emitRoomUpdate(event.roomCode, false);
        this.io.to(event.roomCode).emit('game:started', {
          version: room.version,
          startedAt: event.startedAt,
          message: 'Game started. Get ready...',
        });
        this.emitGameLog(event.roomCode, 'game:started', {
          byPlayerId: room.hostId,
          byPlayerName: room.players[room.hostId]?.name ?? 'Jugador',
        });
        return;
      }
      case 'game-restarted': {
        const room = this.rooms(event.roomCode);
        if (!room) return;
        this.emitRoomUpdate(event.roomCode, false);
        this.io.to(event.roomCode).emit('game:restarted', {
          version: room.version,
          message: 'Game restarted in the same room.',
        });
        this.emitGameLog(event.roomCode, 'game:restarted', {
          byPlayerId: event.playerId,
          byPlayerName: room.players[event.playerId]?.name ?? 'Jugador',
        });
        return;
      }
      case 'game-paused': {
        const room = this.rooms(event.roomCode);
        if (!room) return;
        this.emitRoomUpdate(event.roomCode, false);
        this.io.to(event.roomCode).emit('game:paused', {
          version: room.version,
          by: event.playerId,
        });
        this.emitGameLog(event.roomCode, 'game:paused', {
          byPlayerId: event.playerId,
          byPlayerName: room.players[event.playerId]?.name ?? 'Jugador',
        });
        return;
      }
      case 'game-star-proposed': {
        const room = this.rooms(event.roomCode);
        this.emitGameLog(event.roomCode, 'game:star-proposed', {
          byPlayerId: event.playerId,
          byPlayerName: room?.players[event.playerId]?.name ?? 'Jugador',
        });
        this.emitRoomUpdate(event.roomCode, false);
        return;
      }
      case 'game-star-accepted': {
        const room = this.rooms(event.roomCode);
        this.emitGameLog(event.roomCode, 'game:star-accepted', {
          byPlayerId: event.playerId,
          byPlayerName: room?.players[event.playerId]?.name ?? 'Jugador',
        });
        this.emitRoomUpdate(event.roomCode, false);
        return;
      }
      case 'game-star-used': {
        const room = this.rooms(event.roomCode);
        if (!room) return;
        this.io.to(event.roomCode).emit('game:star-used', {
          version: room.version,
          message: 'Star used. Lowest cards discarded.',
          discarded: event.discarded,
        });
        this.emitGameLog(event.roomCode, 'game:star-used', { byPlayerId: event.playerId, discarded: event.discarded });
        return;
      }
      case 'game-card-played': {
        const room = this.rooms(event.roomCode);
        this.emitGameLog(event.roomCode, 'game:card-played', {
          playerId: event.playerId,
          playerName: room?.players[event.playerId]?.name ?? 'Jugador',
          card: event.card,
        });
        return;
      }
      case 'game-error-penalty': {
        const room = this.rooms(event.roomCode);
        if (!room) return;
        const playedCard = { value: event.card, playerId: event.playerId, playerName: room.players[event.playerId]?.name ?? 'Jugador' };
        const blockingCards = event.blockingCards.map((discard) => ({ ...discard, playerName: room.players[discard.playerId]?.name ?? 'Jugador' }));
        this.io.to(event.roomCode).emit('game:error-penalty', { version: room.version, playedCard, blockingCards, lifeLost: event.lifeLost });
        this.emitGameLog(event.roomCode, 'game:error', { playedCard, blockingCards });
        return;
      }
      case 'game-card-discarded': {
        const room = this.rooms(event.roomCode);
        this.emitGameLog(event.roomCode, 'game:discard', {
          card: event.card,
          playerId: event.playerId,
          playerName: room?.players[event.playerId]?.name ?? 'Jugador',
          ...(event.reason === 'star' ? { reason: 'star' } : {}),
        });
        return;
      }
      case 'game-level-completed': {
        const room = this.rooms(event.roomCode);
        if (!room?.game) return;
        this.io.to(event.roomCode).emit('game:level-complete', {
          version: room.version, levelCompleted: event.level, reward: event.reward, lives: room.game.lives, stars: room.game.stars,
        });
        this.emitGameLog(event.roomCode, 'game:level-complete', { levelCompleted: event.level });
        return;
      }
      case 'game-reward-applied': {
        const room = this.rooms(event.roomCode);
        if (!room?.game) return;
        this.emitGameLog(event.roomCode, 'game:reward', { reward: event.reward, lives: room.game.lives, stars: room.game.stars });
        return;
      }
      case 'game-next-level-ready': {
        const room = this.rooms(event.roomCode);
        if (!room) return;
        this.emitRoomUpdate(event.roomCode, false);
        this.io.to(event.roomCode).emit('game:next-level-ready', { version: room.version, level: event.level });
        this.emitGameLog(event.roomCode, 'game:next-level-ready', { level: event.level });
        return;
      }
      case 'game-over': {
        const room = this.rooms(event.roomCode);
        if (!room) return;
        this.emitRoomUpdate(event.roomCode, false);
        this.io.to(event.roomCode).emit('game:over', { version: room.version, reason: event.reason });
        this.emitGameLog(event.roomCode, 'game:over', { reason: event.reason });
        return;
      }
      case 'game-victory': {
        const room = this.rooms(event.roomCode);
        if (!room?.game) return;
        this.emitGameLog(event.roomCode, 'game:victory', { levelCompleted: room.game.currentLevel, maxLevel: room.game.maxLevel });
        return;
      }
    }
  }
}
