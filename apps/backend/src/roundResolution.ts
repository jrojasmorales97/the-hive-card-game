export type RoundResolutionOutcome = 'game-over' | 'level-complete' | 'pause';

export function getRoundResolutionOutcome(lives: number, remainingCards: number): RoundResolutionOutcome {
  if (lives <= 0) return 'game-over';
  if (remainingCards <= 0) return 'level-complete';
  return 'pause';
}

export function shouldResolveAfterErrorOverlay(outcome: RoundResolutionOutcome): boolean {
  return outcome === 'game-over' || outcome === 'level-complete';
}
