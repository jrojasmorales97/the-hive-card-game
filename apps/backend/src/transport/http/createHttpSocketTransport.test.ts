import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpSocketTransport } from './createHttpSocketTransport.js';

test('HTTP transport serves the health route through the framework adapter', async (t) => {
  const transport = await createHttpSocketTransport('http://localhost:5173');
  t.after(async () => transport.io.close());

  const response = await transport.app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});
