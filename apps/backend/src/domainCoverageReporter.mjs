const threshold = 80;

function isMeasured(file) {
  return /\/src\/(domain\/.*\.ts|application\/.*\.ts|infrastructure\/(memory|runtime|scheduling)\/.*\.ts)$/.test(file.path)
    && !file.path.endsWith('.test.ts')
    && !file.path.endsWith('/model.ts')
    && !file.path.endsWith('/result.ts')
    && !file.path.includes('/ports/');
}

export default async function* domainCoverageReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:coverage') continue;
    const files = event.data.summary.files.filter(isMeasured);
    if (files.length === 0) throw new Error('Backend-layer coverage gate found no measurable files');
    const counts = files.reduce((total, file) => ({
      totalLineCount: total.totalLineCount + file.totalLineCount,
      totalBranchCount: total.totalBranchCount + file.totalBranchCount,
      totalFunctionCount: total.totalFunctionCount + file.totalFunctionCount,
      coveredLineCount: total.coveredLineCount + file.coveredLineCount,
      coveredBranchCount: total.coveredBranchCount + file.coveredBranchCount,
      coveredFunctionCount: total.coveredFunctionCount + file.coveredFunctionCount,
    }), { totalLineCount: 0, totalBranchCount: 0, totalFunctionCount: 0, coveredLineCount: 0, coveredBranchCount: 0, coveredFunctionCount: 0 });
    const metrics = [
      ['lines', counts.coveredLineCount, counts.totalLineCount],
      ['branches', counts.coveredBranchCount, counts.totalBranchCount],
      ['functions', counts.coveredFunctionCount, counts.totalFunctionCount],
    ];
    const rendered = metrics.map(([name, covered, total]) => `${name} ${total === 0 ? 100 : ((covered / total) * 100).toFixed(2)}%`).join(', ');
    yield `Backend-layer coverage (${files.length} files): ${rendered}\n`;
    const failed = metrics.filter(([, covered, total]) => total !== 0 && (covered / total) * 100 < threshold);
    if (failed.length > 0) throw new Error(`Backend-layer coverage below ${threshold}%: ${rendered}`);
  }
}
