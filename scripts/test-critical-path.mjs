import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const requiredSuites = [
  'tests/unit/operations/verify-restored-database-process.test.ts',
  'tests/integration/launch-candidate-critical-path.test.ts',
];

function run() {
  const root = process.cwd();
  let maxWorkers = '2';
  let reportDestination;
  for (const arg of process.argv.slice(2)) {
    if (/^--maxWorkers=[1-9]\d*$/.test(arg)) maxWorkers = arg.slice('--maxWorkers='.length);
    else if (arg.startsWith('--report-json=') && arg.length > '--report-json='.length) {
      reportDestination = path.resolve(root, arg.slice('--report-json='.length));
    } else throw new Error(`Unsupported critical-path option: ${arg}`);
  }

  // Vitest file filters alone can succeed when only one of several requested files exists.
  for (const suite of requiredSuites) {
    let isFile = false;
    try { isFile = statSync(path.resolve(root, suite)).isFile(); } catch { /* handled below */ }
    if (!isFile) throw new Error(`Missing required critical-path suite: ${suite}`);
  }

  const temporary = mkdtempSync(path.join(os.tmpdir(), 'polutek-critical-path-'));
  try {
    const reportPath = path.join(temporary, 'vitest.json');
    const child = spawnSync(process.execPath, [
      path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...requiredSuites,
      `--maxWorkers=${maxWorkers}`, '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`,
    ], { cwd: root, env: process.env, stdio: 'inherit' });
    if (child.error) throw child.error;
    if (child.signal || child.status !== 0) {
      throw new Error(`Critical-path Vitest failed (exit ${child.status}, signal ${child.signal ?? 'none'}).`);
    }

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (report.success !== true || !Array.isArray(report.testResults)) {
      throw new Error('Critical-path report does not confirm success.');
    }
    let passed = 0;
    for (const suite of requiredSuites) {
      const results = report.testResults.filter(result => typeof result.name === 'string'
        && path.resolve(root, result.name) === path.resolve(root, suite));
      if (results.length !== 1 || !Array.isArray(results[0].assertionResults)
        || results[0].assertionResults.length === 0
        || results[0].assertionResults.some(assertion => assertion.status !== 'passed')) {
        throw new Error(`Required suite must contain only passing tests (no empty, skipped or todo suite): ${suite}`);
      }
      passed += results[0].assertionResults.length;
    }
    if (reportDestination) writeFileSync(reportDestination, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(`Critical-path verified: ${requiredSuites.length} required suites, ${passed} tests passed.\n`);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

try { run(); } catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
