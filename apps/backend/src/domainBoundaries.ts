import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

export type BoundaryIssue = { file: string; line: number; message: string };

function importIsForbidden(fileName: string, specifier: string): boolean {
  return specifier === 'fastify'
    || specifier === 'socket.io'
    || specifier.startsWith('@fastify/')
    || specifier.startsWith('node:')
    || specifier === '@the-hive/contracts'
    || (fileName.includes('/domain/') && specifier.startsWith('..'))
    || specifier.includes('/index.')
    || specifier.includes('frontend')
    || specifier.includes('infrastructure')
    || specifier.includes('transport');
}

function issue(source: ts.SourceFile, node: ts.Node, message: string): BoundaryIssue {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { file: source.fileName, line: line + 1, message };
}

/** AST-only checker so tests can characterize every forbidden category without filesystem fixtures. */
export function inspectDomainSource(fileName: string, text: string): BoundaryIssue[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  const issues: BoundaryIssue[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (importIsForbidden(fileName, node.moduleSpecifier.text)) issues.push(issue(source, node, `Forbidden import: ${node.moduleSpecifier.text}`));
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      issues.push(issue(source, node, 'Dynamic imports are forbidden'));
    }
    if (ts.isIdentifier(node) && (node.text === 'process' || node.text === 'setTimeout' || node.text === 'setInterval' || node.text === 'clearTimeout' || node.text === 'clearInterval')) {
      issues.push(issue(source, node, `Forbidden global: ${node.text}`));
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const name = `${node.expression.text}.${node.name.text}`;
      if (name === 'Date.now' || name === 'Math.random') issues.push(issue(source, node, `Forbidden global: ${name}`));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return issues;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

export function checkDomainBoundaries(root = resolve(process.cwd(), 'src')): BoundaryIssue[] {
  const files = [...sourceFiles(join(root, 'domain')), join(root, 'gameStateMachine.ts')];
  return files.flatMap((file) => inspectDomainSource(relative(root, file), readFileSync(file, 'utf8')));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))) {
  const issues = checkDomainBoundaries();
  if (issues.length > 0) {
    for (const entry of issues) console.error(`${entry.file}:${entry.line} ${entry.message}`);
    process.exitCode = 1;
  }
}
