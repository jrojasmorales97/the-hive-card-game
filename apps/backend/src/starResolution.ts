import type { StarDiscardPreview } from './gameTiming.js';

export type StarResolutionPlayerState = {
  id: string;
  connected: boolean;
  socketId: string | null;
  isCpu?: boolean;
};

export type PendingStarResolution = {
  discarded: StarDiscardPreview[];
  awaitingPlayerIds: Set<string>;
  acknowledgedPlayerIds: Set<string>;
};

export function createPendingStarResolution(
  discarded: StarDiscardPreview[],
  players: Record<string, StarResolutionPlayerState>,
): PendingStarResolution {
  const awaitingPlayerIds = new Set<string>();

  discarded.forEach((entry) => {
    const player = players[entry.playerId];
    if (!player || player.isCpu || !player.connected || !player.socketId) return;
    awaitingPlayerIds.add(entry.playerId);
  });

  return {
    discarded,
    awaitingPlayerIds,
    acknowledgedPlayerIds: new Set<string>(),
  };
}

export function acknowledgePendingStarResolution(
  pending: PendingStarResolution,
  playerId: string,
): PendingStarResolution {
  if (!pending.awaitingPlayerIds.has(playerId) || pending.acknowledgedPlayerIds.has(playerId)) return pending;

  const acknowledgedPlayerIds = new Set(pending.acknowledgedPlayerIds);
  acknowledgedPlayerIds.add(playerId);
  return {
    ...pending,
    acknowledgedPlayerIds,
  };
}

export function isPendingStarResolutionComplete(pending: PendingStarResolution): boolean {
  for (const playerId of pending.awaitingPlayerIds) {
    if (!pending.acknowledgedPlayerIds.has(playerId)) return false;
  }
  return true;
}
