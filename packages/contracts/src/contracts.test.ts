import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIdentityPayload, parseJoinRoomPayload, parseKickPayload, parsePlayCardPayload, parseReadyPayload } from './index.js';

test('contract parsers reject hostile shapes and accept valid payloads', () => {
  for (const parser of [parseIdentityPayload, parseJoinRoomPayload, parseKickPayload, parsePlayCardPayload, parseReadyPayload]) {
    assert.equal(parser(null).ok, false);
    assert.equal(parser([]).ok, false);
  }
  assert.deepEqual(parseIdentityPayload({ playerName: 'Host', playerId: 'host-0001' }), { ok: true, value: { playerName: 'Host', playerId: 'host-0001' } });
  assert.equal(parseJoinRoomPayload({ playerName: 'Host', playerId: 'host-0001' }).ok, false);
  assert.equal(parseKickPayload({ targetPlayerId: 1 }).ok, false);
  assert.equal(parseReadyPayload({ ready: 'true' }).ok, false);
  assert.equal(parsePlayCardPayload({ card: '10' }).ok, false);
  assert.deepEqual(parsePlayCardPayload({ card: 10, ignored: true }), { ok: true, value: { card: 10 } });
});
