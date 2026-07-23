import assert from 'node:assert/strict';
import test from 'node:test';
import { SessionRegistry } from './sessionRegistry.js';

test('session registry ignores a stale disconnect after replacement', () => {
  const sessions = new SessionRegistry();
  sessions.bind('old', 'player', 'ROOM01');
  sessions.bind('new', 'player', 'ROOM01');
  assert.equal(sessions.unbindIfActive('old'), undefined);
  assert.deepEqual(sessions.context('new'), { playerId: 'player', roomCode: 'ROOM01' });
  assert.deepEqual(sessions.unbindIfActive('new'), { playerId: 'player', roomCode: 'ROOM01' });
});
