export type StarDiscardPreview = {
  card: number;
  playerId: string;
  playerName: string;
};

export function findMyStarDiscard(discarded: StarDiscardPreview[] | null | undefined, playerId: string): number | null {
  return discarded?.find((entry) => entry.playerId === playerId)?.card ?? null;
}

export function mergeHandWithStarDiscard(hand: number[], discardedCard: number | null): number[] {
  if (discardedCard === null || hand.includes(discardedCard)) return hand;
  return [...hand, discardedCard].sort((a, b) => a - b);
}

export function shouldUseTwoColumnStarDiscardLayout(discardCount: number, playerNames: string[] = []): boolean {
  const longestName = Math.max(0, ...playerNames.map((name) => name.trim().length));
  return discardCount > 6 && longestName <= 18;
}
