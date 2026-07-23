import type { DomainEffect } from '../domain/result.js';
import type { DomainGame, DomainPlayer, DomainRoomStatus } from '../domain/model.js';

/**
 * Application-owned visual settlement coordination. The domain has already
 * consumed the star and selected the preview; this records only which human
 * animations still need to finish before its declared effect can re-enter.
 */
export type StarSettlementWait = {
  effect: DomainEffect;
  awaitingPlayerIds: string[];
  acknowledgedPlayerIds: string[];
};

/** Room aggregate owned by application; connection ids remain exclusively in transport. */
export type ApplicationRoom = {
  code: string;
  displayCode: string;
  shareable: boolean;
  hostId: string;
  status: DomainRoomStatus;
  players: Record<string, DomainPlayer>;
  game: DomainGame | null;
  version: number;
  logs: ApplicationLog[];
  starSettlement?: StarSettlementWait | null;
};

export type ApplicationLog = { id: string; ts: number; type: string; payload: Record<string, unknown> };
export type ApplicationPlayer = DomainPlayer;
