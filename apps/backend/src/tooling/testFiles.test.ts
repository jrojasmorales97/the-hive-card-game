import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { testFiles } from './testFiles.js';

test('test inventory is recursive, stable and excludes production files', () => {
  const root = mkdtempSync(join(tmpdir(), 'hive-tests-'));
  mkdirSync(join(root, 'nested', 'deep'), { recursive: true });
  writeFileSync(join(root, 'z.test.ts'), ''); writeFileSync(join(root, 'nested', 'a.test.ts'), ''); writeFileSync(join(root, 'nested', 'deep', 'live.ts'), '');
  assert.deepEqual(testFiles(root).map((file) => file.replace(/^.*hive-tests-[^/]+\//, '')), ['nested/a.test.ts', 'z.test.ts']);
});
