import type { DomainEffect } from './domain/result.js';
import type { DomainStarDiscardPreview } from './domain/model.js';

export type StarAnimationPlayer = { id: string; connected: boolean; socketId: string | null; isCpu?: boolean };
export type PendingStarAnimation = {
  effect: DomainEffect;
  discarded: DomainStarDiscardPreview[];
  awaitingPlayerIds: Set<string>;
  acknowledgedPlayerIds: Set<string>;
};

/** Infrastructure-only: the supplied preview already decided who settles. */
export function createPendingStarAnimation(
  discarded: DomainStarDiscardPreview[],
  players: Record<string, StarAnimationPlayer>,
  effect: DomainEffect,
): PendingStarAnimation {
  const awaitingPlayerIds = new Set<string>();
  discarded.forEach((entry) => {
    const player = players[entry.playerId];
    if (player && player.connected && player.socketId && !player.isCpu) awaitingPlayerIds.add(player.id);
  });
  return { effect, discarded, awaitingPlayerIds, acknowledgedPlayerIds: new Set<string>() };
}

export function acknowledgeStarAnimation(pending: PendingStarAnimation, playerId: string): PendingStarAnimation {
  if (!pending.awaitingPlayerIds.has(playerId) || pending.acknowledgedPlayerIds.has(playerId)) return pending;
  return { ...pending, acknowledgedPlayerIds: new Set([...pending.acknowledgedPlayerIds, playerId]) };
}

/** A disconnect closes that participant's visual wait; it does not alter game state. */
export function disconnectStarAnimation(pending: PendingStarAnimation, playerId: string): PendingStarAnimation {
  return acknowledgeStarAnimation(pending, playerId);
}

export function isStarAnimationComplete(pending: PendingStarAnimation): boolean {
  return [...pending.awaitingPlayerIds].every((playerId) => pending.acknowledgedPlayerIds.has(playerId));
}
