import assert from 'node:assert/strict';
import test from 'node:test';

import { rejected, succeeded } from './result.js';
import type { DomainMatch } from './model.js';

const match: DomainMatch = { status: 'lobby', hostId: 'alpha', players: {}, game: null };

test('domain results are explicit immutable data', () => {
  const before = structuredClone(match);
  assert.deepEqual(rejected('No stars left'), { ok: false, error: 'No stars left' });
  assert.deepEqual(succeeded(match, [{ type: 'game-restarted' }]), {
    ok: true,
    state: match,
    events: [{ type: 'game-restarted' }],
    effects: [],
  });
  assert.deepEqual(match, before);
});
