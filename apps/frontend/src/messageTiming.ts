export type OverlayMessageKind = 'error' | 'pause' | 'star-used' | 'level-complete' | 'restarted';

export const INFO_MESSAGE_DURATION_MS = 3000;
export const VICTORY_SUBTITLE = 'YOUR MINDS ARE FULLY CONNECTED';
export const DEFEAT_SUBTITLE = 'THE HIVE STILL NEEDS TO BE CONNECTED';
export const STAR_PROPOSAL_SUBTITLE = "ACCEPT ACTIVATION TO DISCARD EVERYONE'S LOWEST CARD";
export const STAR_WAITING_SUBTITLE = 'WAITING FOR EVERYONE TO ACCEPT THE STAR';

const OVERLAY_DURATIONS_MS: Record<OverlayMessageKind, number> = {
  error: 5000,
  pause: 5000,
  'star-used': 5000,
  'level-complete': 3000,
  restarted: 5000,
};

const OVERLAY_SUBTITLES: Record<OverlayMessageKind, string> = {
  error: 'YOU NOW HAVE ONE LIFE LESS',
  pause: 'READY UP AGAIN WHEN EVERYONE IS FOCUSED',
  'star-used': "DISCARDING EVERYONE'S LOWEST CARD",
  'level-complete': 'GET READY FOR THE NEXT LEVEL',
  restarted: 'THE RUN STARTS AGAIN FROM LEVEL ONE',
};

export function overlayDurationMs(kind: OverlayMessageKind): number {
  return OVERLAY_DURATIONS_MS[kind];
}

export function overlaySubtitle(kind: OverlayMessageKind): string {
  return OVERLAY_SUBTITLES[kind];
}

export function deferOverlayMs(baseDelayMs: number, blockingUntil: number | null, now = Date.now()): number {
  const remainingBlockingMs = blockingUntil === null ? 0 : Math.max(0, blockingUntil - now);
  return Math.max(baseDelayMs, remainingBlockingMs);
}
