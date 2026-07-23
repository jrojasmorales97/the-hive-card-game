import type { DomainEffect } from '../domain/result.js';
import type { ApplicationRoom } from './model.js';

export type ApplicationErrorCode = 'not-found' | 'invalid-state' | 'forbidden' | 'room-full' | 'invalid-input' | 'conflict';
export type ApplicationError = { code: ApplicationErrorCode; message: string };
export type ApplicationChange =
  | { type: 'room-created'; room: ApplicationRoom }
  | { type: 'room-saved'; room: ApplicationRoom; expectedVersion: number }
  | { type: 'room-deleted'; roomCode: string }
  | { type: 'player-presence-changed'; roomCode: string; playerId: string; connected: boolean };
export type ApplicationEvent =
  | { type: 'room-joined' | 'room-left' | 'room-reconnected'; roomCode: string; playerId: string; playerName: string }
  | { type: 'room-host-changed'; roomCode: string; fromPlayerId: string; toPlayerId: string }
  | { type: 'room-kicked'; roomCode: string; playerId: string }
  | { type: 'room-disconnected'; roomCode: string; playerId: string; playerName: string }
  | { type: 'room-resynced'; roomCode: string; playerId: string }
  | { type: 'room-updated'; roomCode: string }
  | { type: 'game-started'; roomCode: string; startedAt: number }
  | { type: 'game-restarted'; roomCode: string; playerId: string; startedAt: number }
  | { type: 'game-paused'; roomCode: string; playerId: string }
  | { type: 'game-star-proposed'; roomCode: string; playerId: string }
  | { type: 'game-star-accepted'; roomCode: string; playerId: string }
  | { type: 'game-star-used'; roomCode: string; playerId: string; discarded: Array<{ card: number; playerId: string; playerName: string }> }
  | { type: 'game-card-played'; roomCode: string; playerId: string; card: number }
  | { type: 'game-error-penalty'; roomCode: string; playerId: string; card: number; blockingCards: Array<{ value: number; playerId: string }>; lifeLost: number }
  | { type: 'game-card-discarded'; roomCode: string; playerId: string; card: number; reason: 'error' | 'star' }
  | { type: 'game-level-completed'; roomCode: string; level: number; reward: 'life' | 'star' | null }
  | { type: 'game-reward-applied'; roomCode: string; reward: 'life' | 'star' }
  | { type: 'game-next-level-ready'; roomCode: string; level: number }
  | { type: 'game-over'; roomCode: string; reason: string }
  | { type: 'game-victory'; roomCode: string };

/** Effects retain their room identity so replacement and stale validation never cross aggregates. */
export type ApplicationEffect = DomainEffect & { roomCode: string; expectedVersion: number };

export type ApplicationResult<T> =
  | { ok: false; error: ApplicationError }
  | { ok: true; data: T; changes: ApplicationChange[]; events: ApplicationEvent[]; effects: ApplicationEffect[] };

export const applicationRejected = (code: ApplicationErrorCode, message: string): ApplicationResult<never> => ({ ok: false, error: { code, message } });
export const applicationSucceeded = <T>(data: T, changes: ApplicationChange[] = [], events: ApplicationEvent[] = [], effects: ApplicationEffect[] = []): ApplicationResult<T> => ({ ok: true, data, changes, events, effects });
