import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLayerBoundaries, inspectLayerSource } from './layerBoundaries.js';

test('layer checker accepts the real source graph', () => assert.deepEqual(checkLayerBoundaries(), []));
test('layer checker models all backend layers and rejects inverse imports or operational globals', () => {
  for (const [file, source] of [
    ['application/x.ts', "import 'socket.io';"], ['application/x.ts', "import '../infrastructure/x.js';"], ['application/x.ts', "import('../transport/x.js');"],
    ['application/x.ts', 'Date.now(); setTimeout(() => {}, 1);'],
    ['domain/x.ts', "import '../application/x.js';"], ['domain/x.ts', "import fs from 'node:fs';"], ['domain/x.ts', 'Date.now(); Math.random();'],
    ['infrastructure/x.ts', "import '../transport/x.js';"], ['transport/x.ts', "import '../infrastructure/x.js';"],
    ['application/x.ts', 'import(path);'],
  ]) assert.notEqual(inspectLayerSource(file, source).length, 0, source);

  assert.deepEqual(inspectLayerSource('infrastructure/memory/x.ts', "import type { RoomRepository } from '../../application/ports/roomRepository.js';"), []);
});
