import type { InteractionLock, InteractionLockReason, StarDiscardPreview } from '@the-hive/contracts';
export type { InteractionLock, InteractionLockReason, StarDiscardPreview } from '@the-hive/contracts';

export const DEAL_CARD_INTERVAL_MS = 460;
export const DEAL_SETTLE_MS = 80;
export const ERROR_LOCK_MS = 5000;
export const STAR_RESOLUTION_LOCK_MS = 5000;
export const LEVEL_COMPLETE_LOCK_MS = 5000;

export function createInteractionLock(reason: InteractionLockReason, durationMs: number, now = Date.now()): InteractionLock {
  return {
    reason,
    until: now + Math.max(0, durationMs),
  };
}

export function isInteractionLockActive(lock: InteractionLock | null | undefined, now = Date.now()): boolean {
  return Boolean(lock && lock.until > now);
}

export function getDealLockDuration(cardCount: number): number {
  return Math.max(0, cardCount) * DEAL_CARD_INTERVAL_MS + DEAL_SETTLE_MS;
}

export function discardLowerCards<T extends { hand: number[] }>(players: Record<string, T>, playedCard: number): number {
  let discarded = 0;

  Object.values(players).forEach((player) => {
    const nextHand = player.hand.filter((card) => card >= playedCard);
    discarded += player.hand.length - nextHand.length;
    player.hand = nextHand;
  });

  return discarded;
}

export function previewLowestCardPerPlayer<T extends { id: string; name: string; hand: number[] }>(
  players: Record<string, T>,
): StarDiscardPreview[] {
  const discarded: StarDiscardPreview[] = [];

  Object.values(players).forEach((player) => {
    if (player.hand.length === 0) return;

    discarded.push({
      card: Math.min(...player.hand),
      playerId: player.id,
      playerName: player.name,
    });
  });

  return discarded.sort((a, b) => a.card - b.card || a.playerName.localeCompare(b.playerName));
}

export function applyStarDiscardPreview<T extends { hand: number[] }>(
  players: Record<string, T>,
  discarded: StarDiscardPreview[],
): void {
  discarded.forEach((entry) => {
    const player = players[entry.playerId];
    if (!player) return;

    const discardIndex = player.hand.indexOf(entry.card);
    if (discardIndex === -1) return;
    player.hand.splice(discardIndex, 1);
  });
}

export function discardLowestCardPerPlayer<T extends { id: string; name: string; hand: number[] }>(
  players: Record<string, T>,
): StarDiscardPreview[] {
  const discarded = previewLowestCardPerPlayer(players);
  applyStarDiscardPreview(players, discarded);
  return discarded;
}
