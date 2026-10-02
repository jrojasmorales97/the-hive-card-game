import { io, type Socket } from 'socket.io-client';
import type {
  BasicAck,
  ClientToServerEvents,
  CreateRoomAck,
  CreateRoomPayload,
  JoinRoomAck,
  JoinRoomPayload,
  ResyncAck,
  ServerToClientEvents,
} from '@the-hive/contracts';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type GatewayEventHandlers = {
  connect: () => void;
  disconnect: () => void;
  reconnectAttempt: () => void;
  connectError: () => void;
} & Pick<ServerToClientEvents,
  'room:snapshot' | 'room:update' | 'player:state' | 'game:log' | 'room:kicked' | 'game:error-penalty' | 'game:paused' | 'game:star-used' | 'game:level-complete' | 'game:next-level-ready' | 'game:restarted' | 'game:over'
>;

export type RoomGateway = {
  readonly connected: boolean;
  on: (handlers: GatewayEventHandlers) => void;
  disconnect: () => void;
  createRoom: (payload: CreateRoomPayload) => Promise<CreateRoomAck>;
  joinRoom: (payload: JoinRoomPayload) => Promise<JoinRoomAck>;
  leaveRoom: () => Promise<BasicAck>;
  resyncRoom: () => Promise<ResyncAck>;
  setReady: (ready: boolean) => Promise<BasicAck>;
  startGame: () => Promise<BasicAck>;
  retryGame: () => Promise<BasicAck>;
  playCard: (card: number) => Promise<BasicAck>;
  requestPause: () => Promise<BasicAck>;
  proposeStar: () => Promise<BasicAck>;
  acceptStar: () => Promise<BasicAck>;
  cancelStar: () => Promise<BasicAck>;
  rejectStar: () => Promise<BasicAck>;
  completeStarDiscardAnimation: () => Promise<BasicAck>;
};

function emitWithAck<T>(socket: ClientSocket, event: keyof ClientToServerEvents, payload?: unknown): Promise<T> {
  return new Promise((resolve) => {
    const acknowledge = (response: T) => resolve(response);
    if (typeof payload === 'undefined') {
      (socket as Socket).emit(event, acknowledge);
      return;
    }
    (socket as Socket).emit(event, payload, acknowledge);
  });
}

export function createRoomGateway(url: string): RoomGateway {
  const socket = io(url, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  }) as ClientSocket;

  return {
    get connected() {
      return socket.connected;
    },
    on(handlers) {
      socket.on('connect', handlers.connect);
      socket.on('disconnect', handlers.disconnect);
      (socket as Socket).on('reconnect_attempt', handlers.reconnectAttempt);
      socket.on('connect_error', handlers.connectError);
      socket.on('room:snapshot', handlers['room:snapshot']);
      socket.on('room:update', handlers['room:update']);
      socket.on('player:state', handlers['player:state']);
      socket.on('game:log', handlers['game:log']);
      socket.on('room:kicked', handlers['room:kicked']);
      socket.on('game:error-penalty', handlers['game:error-penalty']);
      socket.on('game:paused', handlers['game:paused']);
      socket.on('game:star-used', handlers['game:star-used']);
      socket.on('game:level-complete', handlers['game:level-complete']);
      socket.on('game:next-level-ready', handlers['game:next-level-ready']);
      socket.on('game:restarted', handlers['game:restarted']);
      socket.on('game:over', handlers['game:over']);
    },
    disconnect: () => socket.disconnect(),
    createRoom: (payload) => emitWithAck<CreateRoomAck>(socket, 'room:create', payload),
    joinRoom: (payload) => emitWithAck<JoinRoomAck>(socket, 'room:join', payload),
    leaveRoom: () => emitWithAck<BasicAck>(socket, 'room:leave'),
    resyncRoom: () => emitWithAck<ResyncAck>(socket, 'room:resync'),
    setReady: (ready) => emitWithAck<BasicAck>(socket, 'player:ready', { ready }),
    startGame: () => emitWithAck<BasicAck>(socket, 'game:start'),
    retryGame: () => emitWithAck<BasicAck>(socket, 'game:retry'),
    playCard: (card) => emitWithAck<BasicAck>(socket, 'game:play-card', { card }),
    requestPause: () => emitWithAck<BasicAck>(socket, 'game:pause-request'),
    proposeStar: () => emitWithAck<BasicAck>(socket, 'star:propose'),
    acceptStar: () => emitWithAck<BasicAck>(socket, 'star:accept'),
    cancelStar: () => emitWithAck<BasicAck>(socket, 'star:cancel'),
    rejectStar: () => emitWithAck<BasicAck>(socket, 'star:reject'),
    completeStarDiscardAnimation: () => emitWithAck<BasicAck>(socket, 'star:discard-animation-complete'),
  };
}
