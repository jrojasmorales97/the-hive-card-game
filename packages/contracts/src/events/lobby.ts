import type { PublicRoomState, RoomSnapshot } from '../state.js';

export type IdentityPayload = { playerName: string; playerId: string };
export type CreateRoomPayload = IdentityPayload;
export type JoinRoomPayload = IdentityPayload & { roomCode: string };
export type KickPayload = { targetPlayerId: string };
export type AckError = { ok: false; error: string };
export type AckOk = { ok: true };
export type CreateRoomAck = AckError | (AckOk & { snapshot: RoomSnapshot; room: PublicRoomState; hand: number[]; yourId: string });
export type JoinRoomAck = AckError | (AckOk & { snapshot: RoomSnapshot; room: PublicRoomState; hand: number[]; yourId: string; reconnected: boolean });
export type ResyncAck = AckError | (AckOk & { snapshot: RoomSnapshot; room: PublicRoomState; hand: number[]; syncedAt: number });
export type BasicAck = AckOk | AckError;
export type RoomKickedPayload = { roomCode: string; message: string };

export type ParseResult<T> = { ok: true; value: T } | { ok: false };
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringField(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === 'string' ? value[key] : null;
}
export function parseIdentityPayload(value: unknown): ParseResult<IdentityPayload> {
  if (!isRecord(value)) return { ok: false };
  const playerName = stringField(value, 'playerName'); const playerId = stringField(value, 'playerId');
  return playerName === null || playerId === null ? { ok: false } : { ok: true, value: { playerName, playerId } };
}
export function parseJoinRoomPayload(value: unknown): ParseResult<JoinRoomPayload> {
  if (!isRecord(value)) return { ok: false };
  const identity = parseIdentityPayload(value); const roomCode = stringField(value, 'roomCode');
  return !identity.ok || roomCode === null ? { ok: false } : { ok: true, value: { ...identity.value, roomCode } };
}
export function parseKickPayload(value: unknown): ParseResult<KickPayload> {
  if (!isRecord(value)) return { ok: false };
  const targetPlayerId = stringField(value, 'targetPlayerId');
  return targetPlayerId === null ? { ok: false } : { ok: true, value: { targetPlayerId } };
}
