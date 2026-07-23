import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

export type BoundaryIssue = { file: string; line: number; message: string };
type Layer = 'domain' | 'application' | 'other';

function layer(file: string): Layer {
  return file.replaceAll('\\', '/').includes('/domain/') || file.startsWith('domain/') ? 'domain'
    : file.replaceAll('\\', '/').includes('/application/') || file.startsWith('application/') ? 'application' : 'other';
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
  return null;
}

/** AST checker for static and dynamic imports; application may depend only on application/domain. */
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
    if (current === 'domain' && ts.isIdentifier(node) && ['process', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'].includes(node.text)) issues.push(issue(source, node, `Forbidden domain global: ${node.text}`));
    if (current === 'domain' && ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && ['Date.now', 'Math.random'].includes(`${node.expression.text}.${node.name.text}`)) issues.push(issue(source, node, `Forbidden domain global: ${node.expression.text}.${node.name.text}`));
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
