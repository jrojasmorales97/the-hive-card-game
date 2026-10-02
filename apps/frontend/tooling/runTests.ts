import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function testFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const args = ['--import', 'tsx', '--test'];
if (process.argv.includes('--coverage')) args.push('--experimental-test-coverage');
const result = spawnSync(process.execPath, [...args, ...testFiles('src'), ...testFiles('tooling')], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
