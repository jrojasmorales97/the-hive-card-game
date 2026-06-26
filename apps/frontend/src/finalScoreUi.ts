export type FinalPodiumTone = 'gold' | 'silver' | 'bronze' | 'none';
export type FinalTimingFeedback = 'ONTIME' | 'SLOW' | 'FAST';
export type FinalTimingBand = 'sync' | 'slightly-fast' | 'very-fast' | 'slightly-slow' | 'very-slow' | 'unrated';

export function shouldUseTwoColumnFinalScoreLayout(playerCount: number): boolean {
  return playerCount > 6;
}

export function podiumToneForRank(index: number): FinalPodiumTone {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return 'none';
}

export function timingFeedbackForBand(band: FinalTimingBand): FinalTimingFeedback {
  if (band === 'slightly-fast' || band === 'very-fast') return 'FAST';
  if (band === 'slightly-slow' || band === 'very-slow') return 'SLOW';
  return 'ONTIME';
}
