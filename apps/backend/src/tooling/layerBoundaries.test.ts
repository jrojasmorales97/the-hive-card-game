import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLayerBoundaries, inspectLayerSource } from './layerBoundaries.js';

test('layer checker accepts the real source graph', () => assert.deepEqual(checkLayerBoundaries(), []));
test('layer checker rejects application dependencies and domain inverse edges', () => {
  for (const [file, source] of [
    ['application/x.ts', "import 'socket.io';"], ['application/x.ts', "import '../infrastructure/x.js';"], ['application/x.ts', "import('../transport/x.js');"],
    ['domain/x.ts', "import '../application/x.js';"], ['domain/x.ts', "import fs from 'node:fs';"], ['domain/x.ts', 'Date.now();'],
  ]) assert.notEqual(inspectLayerSource(file, source).length, 0, source);
});
