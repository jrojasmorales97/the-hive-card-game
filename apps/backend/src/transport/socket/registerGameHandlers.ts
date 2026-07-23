import type { Ack, BasicAck, ClientToServerEvents, ServerToClientEvents } from '@the-hive/contracts';
import { parsePlayCardPayload, parseReadyPayload } from '@the-hive/contracts';
import type { Server } from 'socket.io';
import type { GameUseCases } from '../../application/gameUseCases.js';
import type { ApplicationRoom } from '../../application/model.js';
import type { StarUseCases } from '../../application/starUseCases.js';
import { SessionRegistry } from './sessionRegistry.js';

type SocketServer = Server<ClientToServerEvents, ServerToClientEvents>;
type Context = { playerId: string; roomCode: string; room: ApplicationRoom };

export type RegisterGameHandlersDependencies = {
  io: SocketServer;
  sessions: SessionRegistry;
  getRoom: (roomCode: string) => ApplicationRoom | undefined;
  games: GameUseCases;
  stars: StarUseCases;
};

/** Wire-only gameplay handlers: parser, active session and acknowledgement. */
export function registerGameHandlers(dependencies: RegisterGameHandlersDependencies): void {
  const context = (socketId: string): Context | undefined => {
    const session = dependencies.sessions.context(socketId);
    if (!session || !dependencies.sessions.isActive(socketId, session.playerId)) return undefined;
    const room = dependencies.getRoom(session.roomCode);
    return room?.players[session.playerId] ? { ...session, room } : undefined;
  };
  const reject = (ack: Ack<BasicAck> | undefined, message: string): void => ack?.({ ok: false, error: message });

  dependencies.io.on('connection', (socket) => {
    socket.on('player:ready', (payload, ack) => {
      const current = context(socket.id);
      if (!current) return reject(ack, 'You are not in a room');
      const parsed = parseReadyPayload(payload);
      if (!parsed.ok) return reject(ack, 'Invalid ready state');
      const result = dependencies.games.setPlayerReady({ ...current, ready: parsed.value.ready });
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('game:start', (ack) => {
      const current = context(socket.id);
      if (!current) return reject(ack, 'You are not in a room');
      const result = dependencies.games.startGame(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('game:retry', (ack) => {
      const current = context(socket.id);
      if (!current) return reject(ack, 'You are not in a room');
      const result = dependencies.games.retryGame(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('game:play-card', (payload, ack) => {
      const current = context(socket.id);
      if (!current) return reject(ack, 'You are not in a room');
      const parsed = parsePlayCardPayload(payload);
      if (!parsed.ok) return reject(ack, 'Invalid card');
      const result = dependencies.games.playCard({ ...current, card: parsed.value.card });
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('game:pause-request', (ack) => {
      const current = context(socket.id);
      if (!current || !current.room.game) return reject(ack, 'Invalid game state');
      const result = dependencies.games.requestPause(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('star:propose', (ack) => {
      const current = context(socket.id);
      if (!current || !current.room.game) return reject(ack, 'Invalid game state');
      const result = dependencies.stars.proposeStar(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('star:accept', (ack) => {
      const current = context(socket.id);
      if (!current || !current.room.game?.starProposal) return reject(ack, 'There is no active star proposal');
      const result = dependencies.stars.acceptStar(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('star:cancel', (ack) => {
      const current = context(socket.id);
      if (!current || !current.room.game?.starProposal) return reject(ack, 'There is no active star proposal');
      const result = dependencies.stars.cancelStar(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('star:reject', (ack) => {
      const current = context(socket.id);
      if (!current || !current.room.game?.starProposal) return reject(ack, 'There is no active star proposal');
      const result = dependencies.stars.rejectStar(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
    socket.on('star:discard-animation-complete', (ack) => {
      const current = context(socket.id);
      if (!current) return reject(ack, 'You are not in a room');
      const result = dependencies.stars.completeStarAnimation(current);
      return result.ok ? ack?.({ ok: true }) : reject(ack, result.error.message);
    });
  });
}
