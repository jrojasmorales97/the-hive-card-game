import assert from 'node:assert/strict';
import test from 'node:test';

import { checkDomainBoundaries, inspectDomainSource } from './domainBoundaries.js';

test('domain boundary checker accepts the real logical boundary', () => {
  assert.deepEqual(checkDomainBoundaries(), []);
});

test('domain boundary checker rejects every forbidden dependency category', () => {
  const cases = [
    ['fastify', "import Fastify from 'fastify';"],
    ['socket', "import { Server } from 'socket.io';"],
    ['fastify plugin', "import cors from '@fastify/cors';"],
    ['node builtin', "import fs from 'node:fs';"],
    ['wire contract', "import type { GamePhase } from '@the-hive/contracts';"],
    ['shell', "import '../index.js';"],
    ['domain to shell', "import '../domainAdapter.js';"],
    ['dynamic import', "import('socket.io');"],
    ['environment', 'process.env.PORT;'],
    ['clock', 'Date.now();'],
    ['random', 'Math.random();'],
    ['timer', 'setTimeout(() => {}, 1); clearInterval(timer);'],
  ] as const;
  for (const [name, source] of cases) {
    const fileName = name === 'domain to shell' ? 'src/domain/example.ts' : `${name}.ts`;
    assert.notEqual(inspectDomainSource(fileName, source).length, 0, name);
  }
});
