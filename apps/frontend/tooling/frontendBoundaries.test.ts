import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectFrontendBoundaries } from './frontendBoundaries.js';

function fixture(files: Record<string, string>): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'the-hive-boundaries-'));
  for (const [path, contents] of Object.entries(files)) {
    const destination = join(root, path);
    mkdirSync(join(destination, '..'), { recursive: true });
    writeFileSync(destination, contents);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('accepts feature public APIs and shared dependencies', () => {
  const { root, cleanup } = fixture({
    'app/App.ts': "import {} from '../features/game/index.js';",
    'features/game/index.ts': "import {} from '../../shared/ui/index.js';",
    'shared/ui/index.ts': 'export {};'
  });
  try {
    assert.deepEqual(inspectFrontendBoundaries(root), []);
  } finally {
    cleanup();
  }
});

test('rejects feature internals, app imports, sibling imports, and cycles', () => {
  const { root, cleanup } = fixture({
    'app/App.ts': "import {} from '../features/game/GameScreen.js';",
    'features/game/GameScreen.ts': "import {} from '../../app/state/index.js'; import {} from '../lobby/index.js'; import {} from './loop.js';",
    'features/game/loop.ts': "import {} from './GameScreen.js';",
    'features/game/index.ts': 'export {};',
    'features/lobby/index.ts': 'export {};',
    'app/state/index.ts': 'export {};'
  });
  try {
    const issues = inspectFrontendBoundaries(root);
    assert.ok(issues.some((issue) => issue.includes('feature internals')));
    assert.ok(issues.some((issue) => issue.includes('features may not import app internals')));
    assert.ok(issues.some((issue) => issue.includes('features may not import sibling feature lobby')));
    assert.ok(issues.some((issue) => issue.startsWith('Import cycle:')));
  } finally {
    cleanup();
  }
});
