import type { ClientToServerEvents, ServerToClientEvents } from '@the-hive/contracts';
import { parseIdentityPayload, parseJoinRoomPayload, parseKickPayload } from '@the-hive/contracts';
import type { Server } from 'socket.io';
import type { RoomUseCases } from '../../application/roomUseCases.js';
import type { ApplicationRoom } from '../../application/model.js';
import type { Clock } from '../../application/ports/clock.js';
import { RoomPresenter } from './roomPresenter.js';
import { SessionRegistry } from './sessionRegistry.js';

type SocketServer = Server<ClientToServerEvents, ServerToClientEvents>;
type Context = { playerId: string; roomCode: string; room: ApplicationRoom };

export type RegisterRoomHandlersDependencies = {
  io: SocketServer;
  useCases: RoomUseCases;
  sessions: SessionRegistry;
  presenter: RoomPresenter;
  clock: Clock;
  getRoom: (roomCode: string) => ApplicationRoom | undefined;
  findRoomCodeByPlayer: (playerId: string) => string | undefined;
  resolveJoinRoom: (requestedRoomCode: string, playerId: string) => { roomCode: string } | { error: string };
  isValidPlayerId: (playerId: string) => boolean;
  onPlayerDisconnected: (roomCode: string, playerId: string) => void;
};

/** Wire-only room family: parse, resolve active identity, invoke a use case, and translate its ack. */
export function registerRoomHandlers(dependencies: RegisterRoomHandlersDependencies): void {
  const context = (socketId: string): Context | undefined => {
    const session = dependencies.sessions.context(socketId);
    if (!session) return undefined;
    const room = dependencies.getRoom(session.roomCode);
    const player = room?.players[session.playerId];
    return room && player && dependencies.sessions.isActive(socketId, session.playerId) ? { ...session, room } : undefined;
  };
  const releasePrevious = (socketId: string, playerId: string, exceptRoomCode?: string): void => {
    const previousSocket = dependencies.sessions.context(socketId);
    if (previousSocket && previousSocket.playerId !== playerId) dependencies.useCases.leaveRoom(previousSocket);
    const priorRoom = dependencies.findRoomCodeByPlayer(playerId);
    if (priorRoom && priorRoom !== exceptRoomCode) dependencies.useCases.leaveRoom({ roomCode: priorRoom, playerId });
  };
  const bind = (socketId: string, playerId: string, roomCode: string): void => {
    const replaced = dependencies.sessions.bind(socketId, playerId, roomCode);
    if (replaced && replaced !== socketId) dependencies.io.sockets.sockets.get(replaced)?.disconnect(true);
  };

  dependencies.io.on('connection', (socket) => {
    socket.on('room:create', (payload, ack) => {
      const parsed = parseIdentityPayload(payload);
      if (!parsed.ok) return ack?.({ ok: false, error: 'Invalid player name or identifier' });
      const playerId = parsed.value.playerId.trim();
      const playerName = parsed.value.playerName.trim();
      if (!playerId || !playerName || !dependencies.isValidPlayerId(playerId)) return ack?.({ ok: false, error: 'Invalid player name or identifier' });
      releasePrevious(socket.id, playerId);
      const result = dependencies.useCases.createRoom({ playerId, playerName });
      if (!result.ok) return ack?.({ ok: false, error: result.error.message });
      bind(socket.id, playerId, result.data.room.code);
      void socket.join(result.data.room.code);
      return ack?.({ ok: true, snapshot: dependencies.presenter.snapshot(result.data.room, result.data.room.players[playerId]), room: dependencies.presenter.publicState(result.data.room), hand: [], yourId: playerId });
    });

    socket.on('room:join', (payload, ack) => {
      const parsed = parseJoinRoomPayload(payload);
      if (!parsed.ok) return ack?.({ ok: false, error: 'Invalid room code, name, or identifier' });
      const requestedRoomCode = parsed.value.roomCode.trim().toUpperCase();
      const playerId = parsed.value.playerId.trim();
      const playerName = parsed.value.playerName.trim();
      if (!requestedRoomCode || !playerId || !playerName || !dependencies.isValidPlayerId(playerId)) return ack?.({ ok: false, error: 'Invalid room code, name, or identifier' });
      const resolved = dependencies.resolveJoinRoom(requestedRoomCode, playerId);
      if ('error' in resolved) return ack?.({ ok: false, error: resolved.error });
      releasePrevious(socket.id, playerId, resolved.roomCode);
      const existing = dependencies.getRoom(resolved.roomCode)?.players[playerId];
      const result = existing
        ? dependencies.useCases.reconnectPlayer({ roomCode: resolved.roomCode, playerId, playerName })
        : dependencies.useCases.joinRoom({ roomCode: resolved.roomCode, playerId, playerName });
      if (!result.ok) return ack?.({ ok: false, error: result.error.message });
      bind(socket.id, playerId, resolved.roomCode);
      void socket.join(resolved.roomCode);
      const room = result.data.room;
      return ack?.({ ok: true, snapshot: dependencies.presenter.snapshot(room, room.players[playerId]), room: dependencies.presenter.publicState(room), hand: [...room.players[playerId].hand].sort((a, b) => a - b), yourId: playerId, reconnected: result.data.reconnected });
    });

    socket.on('room:leave', (ack) => {
      const current = context(socket.id);
      if (!current) return ack?.({ ok: false, error: 'You are not in a room' });
      const result = dependencies.useCases.leaveRoom(current);
      return ack?.(result.ok ? { ok: true } : { ok: false, error: result.error.message });
    });

    socket.on('room:kick', (payload, ack) => {
      const current = context(socket.id);
      if (!current) return ack?.({ ok: false, error: 'You are not in a room' });
      const parsed = parseKickPayload(payload);
      const result = dependencies.useCases.kickPlayer({ ...current, targetPlayerId: parsed.ok ? parsed.value.targetPlayerId.trim() : undefined });
      return ack?.(result.ok ? { ok: true } : { ok: false, error: result.error.message });
    });

    socket.on('room:resync', (ack) => {
      const current = context(socket.id);
      if (!current) return ack?.({ ok: false, error: 'You are not in a room' });
      const result = dependencies.useCases.resyncRoom(current);
      if (!result.ok) return ack?.({ ok: false, error: result.error.message });
      const serverTime = dependencies.clock.now();
      return ack?.({ ok: true, snapshot: dependencies.presenter.snapshot(result.data.room, result.data.player, serverTime), room: dependencies.presenter.publicState(result.data.room), hand: [...result.data.player.hand].sort((a, b) => a - b), syncedAt: serverTime });
    });

    socket.on('disconnect', () => {
      const current = dependencies.sessions.unbindIfActive(socket.id);
      if (!current) return;
      const result = dependencies.useCases.disconnectPlayer(current);
      if (result.ok) dependencies.onPlayerDisconnected(current.roomCode, current.playerId);
    });
  });
}
