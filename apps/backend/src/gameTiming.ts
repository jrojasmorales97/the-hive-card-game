export type InteractionLockReason = 'dealing' | 'countdown' | 'error' | 'star' | 'level-complete';

export type InteractionLock = {
  reason: InteractionLockReason;
  until: number;
};

export type StarDiscardPreview = {
  card: number;
  playerId: string;
  playerName: string;
};

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

export function discardLowestCardPerPlayer<T extends { id: string; name: string; hand: number[] }>(
  players: Record<string, T>,
): StarDiscardPreview[] {
  const discarded: StarDiscardPreview[] = [];

  Object.values(players).forEach((player) => {
    if (player.hand.length === 0) return;

    const lowest = Math.min(...player.hand);
    player.hand = player.hand.filter((card) => card !== lowest);
    discarded.push({
      card: lowest,
      playerId: player.id,
      playerName: player.name,
    });
  });

  return discarded.sort((a, b) => a.card - b.card || a.playerName.localeCompare(b.playerName));
}
