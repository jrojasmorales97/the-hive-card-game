/* node:coverage ignore next -- declaration-only contract surface */
import type { PublicRoomEnvelope, PrivatePlayerEnvelope, RoomSnapshot } from '../state.js';
import type { GameLogEvent } from '../logs.js';
import type { BasicAck, CreateRoomAck, CreateRoomPayload, JoinRoomAck, JoinRoomPayload, KickPayload, ResyncAck, RoomKickedPayload } from './lobby.js';
import type { ErrorPenaltyPayload, PausePayload, PlayCardPayload, ReadyPayload, VersionedMessage } from './round.js';
import type { StarUsedPayload } from './star.js';
import type { GameOverPayload, LevelCompletePayload, NextLevelReadyPayload } from './progression.js';
export type Ack<T> = (response: T) => void;
export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack?: Ack<CreateRoomAck>) => void;
  'room:join': (payload: JoinRoomPayload, ack?: Ack<JoinRoomAck>) => void;
  'room:leave': (ack?: Ack<BasicAck>) => void;
  'room:resync': (ack?: Ack<ResyncAck>) => void;
  'room:kick': (payload: KickPayload, ack?: Ack<BasicAck>) => void;
  'player:ready': (payload: ReadyPayload, ack?: Ack<BasicAck>) => void;
  'game:start': (ack?: Ack<BasicAck>) => void;
  'game:retry': (ack?: Ack<BasicAck>) => void;
  'game:play-card': (payload: PlayCardPayload, ack?: Ack<BasicAck>) => void;
  'game:pause-request': (ack?: Ack<BasicAck>) => void;
  'star:propose': (ack?: Ack<BasicAck>) => void;
  'star:accept': (ack?: Ack<BasicAck>) => void;
  'star:cancel': (ack?: Ack<BasicAck>) => void;
  'star:reject': (ack?: Ack<BasicAck>) => void;
  'star:discard-animation-complete': (ack?: Ack<BasicAck>) => void;
}
export interface ServerToClientEvents {
  'room:update': (payload: PublicRoomEnvelope) => void;
  'player:state': (payload: PrivatePlayerEnvelope) => void;
  'room:snapshot': (payload: RoomSnapshot) => void;
  'game:log': (entry: GameLogEvent) => void;
  'room:kicked': (payload: RoomKickedPayload) => void;
  'game:started': (payload: VersionedMessage & { startedAt: number }) => void;
  'game:over': (payload: GameOverPayload) => void;
  'game:level-complete': (payload: LevelCompletePayload) => void;
  'game:next-level-ready': (payload: NextLevelReadyPayload) => void;
  'game:error-penalty': (payload: ErrorPenaltyPayload) => void;
  'game:star-used': (payload: StarUsedPayload) => void;
  'game:restarted': (payload: VersionedMessage) => void;
  'game:paused': (payload: PausePayload) => void;
}
