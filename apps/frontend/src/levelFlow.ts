export type LevelCompleteOverlayInput = {
  currentPileCount: number;
  previousPileCount: number;
  blockingUntil: number | null;
  now?: number;
};

const CLEAR_ANIMATION_BASE_MS = 520;
const CLEAR_STEP_DELAY_MS = 48;
const SETTLE_BUFFER_MS = 120;
const LAST_CARD_SETTLE_MS = 340;

export function levelCompleteOverlayDelayMs(input: LevelCompleteOverlayInput): number {
  const now = input.now ?? Date.now();
  const hasFreshPileEntry = input.currentPileCount > input.previousPileCount;
  const totalClearMs =
    (hasFreshPileEntry ? LAST_CARD_SETTLE_MS : 0) +
    CLEAR_ANIMATION_BASE_MS +
    Math.max(0, input.currentPileCount - 1) * CLEAR_STEP_DELAY_MS +
    SETTLE_BUFFER_MS;
  const remainingBlockingMs = input.blockingUntil === null ? 0 : Math.max(0, input.blockingUntil - now);

  return Math.max(totalClearMs, remainingBlockingMs);
}
