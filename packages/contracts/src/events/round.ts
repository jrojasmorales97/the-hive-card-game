import type { BasicAck } from './lobby.js';
export type ReadyPayload = { ready: boolean };
export type PlayCardPayload = { card: number };
export type VersionedMessage = { version: number; message: string };
export type PausePayload = { version: number; by: string };
export type ErrorPenaltyPayload = { version: number; playedCard: { value: number; playerId: string; playerName: string }; blockingCards: Array<{ value: number; playerId: string; playerName: string }>; lifeLost: number };
export function parseReadyPayload(value: unknown): { ok: true; value: ReadyPayload } | { ok: false } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { ready?: unknown }).ready === 'boolean'
    ? { ok: true, value: { ready: (value as { ready: boolean }).ready } } : { ok: false };
}
export function parsePlayCardPayload(value: unknown): { ok: true; value: PlayCardPayload } | { ok: false } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Number.isInteger((value as { card?: unknown }).card)
    ? { ok: true, value: { card: (value as { card: number }).card } } : { ok: false };
}
export type RoundAck = BasicAck;
