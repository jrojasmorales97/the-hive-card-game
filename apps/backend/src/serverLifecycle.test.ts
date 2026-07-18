import assert from 'node:assert/strict';
import test from 'node:test';

import { startServer, stopServer } from './index.js';

test('startServer can start again after stopServer closes the transport', async (t) => {
  t.after(async () => stopServer());

  const first = await startServer({ port: 0, host: '127.0.0.1' });
  assert.ok(first.port > 0);
  await stopServer();

  const second = await startServer({ port: 0, host: '127.0.0.1' });
  assert.ok(second.port > 0);
});
