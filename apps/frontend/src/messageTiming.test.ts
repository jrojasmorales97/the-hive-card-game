import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFEAT_SUBTITLE,
  INFO_MESSAGE_DURATION_MS,
  STAR_PROPOSAL_SUBTITLE,
  STAR_WAITING_SUBTITLE,
  VICTORY_SUBTITLE,
  deferOverlayMs,
  overlayDurationMs,
  gameplayOverlayBlockedReason,
  overlaySubtitle,
} from './messageTiming.js';

test('overlayDurationMs returns the planned durations for each overlay kind', () => {
  assert.equal(overlayDurationMs('error'), 5000);
  assert.equal(overlayDurationMs('pause'), 5000);
  assert.equal(overlayDurationMs('star-used'), 5000);
  assert.equal(overlayDurationMs('level-complete'), 3000);
  assert.equal(overlayDurationMs('restarted'), 5000);
});

test('every visible gameplay overlay blocks actions until its message disappears', () => {
  for (const kind of ['error', 'pause', 'star-used', 'level-complete', 'restarted'] as const) {
    assert.equal(gameplayOverlayBlockedReason(kind), 'Wait until the current message finishes');
  }
  assert.equal(gameplayOverlayBlockedReason(null), null);
});

test('INFO_MESSAGE_DURATION_MS keeps short informational messages brief', () => {
  assert.equal(INFO_MESSAGE_DURATION_MS, 3000);
});

test('overlaySubtitle exposes stable explanatory subtitles for blocking overlays', () => {
  assert.equal(overlaySubtitle('error'), 'YOU NOW HAVE ONE LIFE LESS');
  assert.equal(overlaySubtitle('pause'), 'READY UP AGAIN WHEN EVERYONE IS FOCUSED');
  assert.equal(overlaySubtitle('star-used'), "DISCARDING EVERYONE'S LOWEST CARD");
  assert.equal(overlaySubtitle('level-complete'), 'GET READY FOR THE NEXT LEVEL');
  assert.equal(overlaySubtitle('restarted'), 'THE RUN STARTS AGAIN FROM LEVEL ONE');
});

test('message subtitle constants cover proposal, waiting, victory, and defeat states', () => {
  assert.equal(STAR_PROPOSAL_SUBTITLE, "ACCEPT ACTIVATION TO DISCARD EVERYONE'S LOWEST CARD");
  assert.equal(STAR_WAITING_SUBTITLE, 'WAITING FOR EVERYONE TO ACCEPT THE STAR');
  assert.equal(VICTORY_SUBTITLE, 'YOUR MINDS ARE FULLY CONNECTED');
  assert.equal(DEFEAT_SUBTITLE, 'THE HIVE STILL NEEDS TO BE CONNECTED');
});

test('deferOverlayMs waits for the active blocking overlay when needed', () => {
  assert.equal(deferOverlayMs(1200, null, 1000), 1200);
  assert.equal(deferOverlayMs(1200, 1800, 1000), 1200);
  assert.equal(deferOverlayMs(1200, 3200, 1000), 2200);
});
