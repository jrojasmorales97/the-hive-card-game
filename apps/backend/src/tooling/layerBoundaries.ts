import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

export type BoundaryIssue = { file: string; line: number; message: string };
type Layer = 'domain' | 'application' | 'infrastructure' | 'transport' | 'other';

function layer(file: string): Layer {
  const normalized = file.replaceAll('\\', '/');
  return normalized.includes('/domain/') || normalized.startsWith('domain/') ? 'domain'
    : normalized.includes('/application/') || normalized.startsWith('application/') ? 'application'
      : normalized.includes('/infrastructure/') || normalized.startsWith('infrastructure/') ? 'infrastructure'
        : normalized.includes('/transport/') || normalized.startsWith('transport/') ? 'transport' : 'other';
}

function issue(source: ts.SourceFile, node: ts.Node, message: string): BoundaryIssue {
  return { file: source.fileName, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message };
}

function forbidden(current: Layer, specifier: string): string | null {
  if (current === 'domain') {
    if (specifier.startsWith('..')) return `Domain cannot import outside domain: ${specifier}`;
    if (/^(fastify|socket\.io|@fastify\/|node:|@the-hive\/contracts)/.test(specifier) || /(?:infrastructure|transport|application|index\.)/.test(specifier)) return `Forbidden domain import: ${specifier}`;
  }
  if (current === 'application') {
    if (/^(fastify|socket\.io|@fastify\/|node:|@the-hive\/contracts)/.test(specifier) || /(?:infrastructure|transport|index\.)/.test(specifier)) return `Forbidden application import: ${specifier}`;
  }
  if (current === 'infrastructure' && /(?:transport|index\.)/.test(specifier)) return `Forbidden infrastructure import: ${specifier}`;
  if (current === 'transport' && /(?:infrastructure|index\.)/.test(specifier)) return `Forbidden transport import: ${specifier}`;
  return null;
}

/** AST checker for static and dynamic imports across domain, application, infrastructure, and transport. */
export function inspectLayerSource(fileName: string, text: string): BoundaryIssue[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  // Standalone fixtures use a bare filename and model the stricter domain boundary.
  const current = layer(fileName) === 'other' ? 'domain' : layer(fileName);
  const issues: BoundaryIssue[] = [];
  const check = (node: ts.Node, specifier: string) => {
    const message = forbidden(current, specifier);
    if (message) issues.push(issue(source, node, message));
  };
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(node, node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0])) issues.push(issue(source, node, 'Dynamic imports must use a literal'));
      else check(node, node.arguments[0].text);
    }
    if ((current === 'domain' || current === 'application') && ts.isIdentifier(node) && ['process', 'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'clearImmediate'].includes(node.text)) issues.push(issue(source, node, `Forbidden ${current} global: ${node.text}`));
    if ((current === 'domain' || current === 'application') && ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && ['Date.now', 'Math.random'].includes(`${node.expression.text}.${node.name.text}`)) issues.push(issue(source, node, `Forbidden ${current} global: ${node.expression.text}.${node.name.text}`));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return issues;
}

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [file] : [];
  });
}

export function checkLayerBoundaries(root = resolve(process.cwd(), 'src')): BoundaryIssue[] {
  return sources(root)
    .filter((file) => layer(relative(root, file)) !== 'other')
    .flatMap((file) => inspectLayerSource(relative(root, file), readFileSync(file, 'utf8')));
}

if (process.argv[1]?.endsWith('layerBoundaries.ts')) {
  const issues = checkLayerBoundaries();
  for (const entry of issues) console.error(`${entry.file}:${entry.line} ${entry.message}`);
  if (issues.length) process.exitCode = 1;
}
