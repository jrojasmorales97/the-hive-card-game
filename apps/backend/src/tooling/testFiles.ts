import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** Lists every co-located TypeScript test in a stable order for Node 20. */
export function testFiles(root = resolve(process.cwd(), 'src')): string[] {
  const visit = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = join(directory, entry.name);
      return entry.isDirectory() ? visit(file) : entry.isFile() && entry.name.endsWith('.test.ts') ? [file] : [];
    });
  const files = visit(root).sort((left, right) => left.localeCompare(right));
  if (files.length === 0) throw new Error(`No TypeScript test files found below ${root}`);
  return files.map((file) => relative(process.cwd(), file));
}

if (process.argv[1]?.endsWith('testFiles.ts')) process.stdout.write(`${testFiles().join(' ')}\n`);
