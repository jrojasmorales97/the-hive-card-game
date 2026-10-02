import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const importPattern = /from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

function resolveSourceImport(sourceFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(sourceFile), specifier);
  const candidates = extname(base)
    ? [base, base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx')]
    : [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find(existsSync) ?? null;
}

function sourcePath(root: string, file: string): string {
  return relative(root, file).replaceAll('\\', '/');
}

export function inspectFrontendBoundaries(root = resolve(process.cwd(), 'src')): string[] {
  const files = sourceFiles(root);
  const edges = new Map<string, string[]>();
  const violations: string[] = [];

  for (const file of files) {
    const path = sourcePath(root, file);
    const source = readFileSync(file, 'utf8');
    const specifiers = [...source.matchAll(importPattern)]
      .map((match) => match[1] ?? match[2] ?? match[3])
      .filter((specifier): specifier is string => Boolean(specifier));
    const imports = specifiers
      .map((specifier) => resolveSourceImport(file, specifier))
      .filter((target): target is string => target !== null && files.includes(target));
    edges.set(path, imports.map((target) => sourcePath(root, target)));

    for (const target of imports) {
      const targetPath = sourcePath(root, target);
      if (path.startsWith('shared/') && (targetPath.startsWith('app/') || targetPath.startsWith('features/'))) {
        violations.push(`${path}: shared may not import app or features`);
      }
      if (path.startsWith('features/') && targetPath.startsWith('app/')) {
        violations.push(`${path}: features may not import app internals`);
      }
      if (path.startsWith('features/') && targetPath.startsWith('features/')) {
        const owner = path.split('/')[1];
        const targetOwner = targetPath.split('/')[1];
        if (owner !== targetOwner) violations.push(`${path}: features may not import sibling feature ${targetOwner}`);
      }
      if (!path.startsWith(`features/${targetPath.split('/')[1]}/`) && targetPath.startsWith('features/') && !targetPath.endsWith('/index.ts')) {
        violations.push(`${path}: feature internals must be imported through ${targetPath.split('/').slice(0, 2).join('/')}/index.ts`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (path: string, trail: string[]): void => {
    if (visiting.has(path)) {
      const start = trail.indexOf(path);
      violations.push(`Import cycle: ${[...trail.slice(start), path].join(' -> ')}`);
      return;
    }
    if (visited.has(path)) return;
    visiting.add(path);
    for (const target of edges.get(path) ?? []) visit(target, [...trail, path]);
    visiting.delete(path);
    visited.add(path);
  };
  for (const file of edges.keys()) visit(file, []);

  return [...new Set(violations)];
}

if (process.argv[1]?.endsWith('frontendBoundaries.ts')) {
  const issues = inspectFrontendBoundaries();
  if (issues.length > 0) throw new Error(`Frontend boundaries violated:\n${issues.join('\n')}`);
}
