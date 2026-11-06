import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureGitSource, sha256 } from './ops/release/source.mjs';

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

  let source;
  let sourceCaptureError = null;
  try {
    source = captureGitSource(root);
  } catch (error) {
    sourceCaptureError = error instanceof Error ? error.message : String(error);
    const revisionResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
    const diffResult = spawnSync('git', ['diff', '--binary', 'HEAD'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const statusResult = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
    if (revisionResult.status !== 0 || diffResult.status !== 0 || statusResult.status !== 0) {
      throw new Error('Cannot identify source after source inventory failed.');
    }
    source = {
      revision: revisionResult.stdout.trim(),
      fingerprint: sha256(`${diffResult.stdout}\0${statusResult.stdout}`),
      files: [],
    };
  }
  const gitStatus = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (gitStatus.error || gitStatus.status !== 0) throw new Error('Cannot determine critical-path worktree state.');
  const workingTreeClean = gitStatus.stdout.trim() === '';

  let report = null;
  let child = null;
  let receiptWritten = false;
  const writeReceipt = (result, failure = null) => {
    if (!reportDestination || receiptWritten) return;
    const requiredResults = requiredSuites.map((suite) => {
      const matches = Array.isArray(report?.testResults) ? report.testResults.filter(item => typeof item.name === 'string'
        && path.resolve(root, item.name) === path.resolve(root, suite)) : [];
      const assertions = matches.length === 1 && Array.isArray(matches[0].assertionResults) ? matches[0].assertionResults : [];
      return {
        suite,
        files: matches.length,
        tests: assertions.length,
        failed: assertions.filter(item => item.status === 'failed').length,
        skipped: assertions.filter(item => item.status === 'skipped' || item.status === 'pending' || item.status === 'todo').length,
        passed: assertions.filter(item => item.status === 'passed').length,
      };
    });
    const evidence = {
      schemaVersion: 1,
      revision: source.revision,
      sourceFingerprint: source.fingerprint,
      trackedFiles: source.files.length,
      ...(sourceCaptureError ? { sourceCaptureError } : {}),
      workingTreeClean,
      result,
      exitCode: child?.status ?? null,
      signal: child?.signal ?? null,
      tests: {
        collected: report ? report.numTotalTests ?? requiredResults.reduce((sum, item) => sum + item.tests, 0) : null,
        passed: report ? report.numPassedTests ?? requiredResults.reduce((sum, item) => sum + item.passed, 0) : null,
        failed: report ? report.numFailedTests ?? requiredResults.reduce((sum, item) => sum + item.failed, 0) : null,
        skipped: report ? (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0)
          || requiredResults.reduce((sum, item) => sum + item.skipped, 0) : null,
        executed: report ? (report.numPassedTests ?? 0) + (report.numFailedTests ?? 0)
          : requiredResults.some(item => item.files > 0) ? requiredResults.reduce((sum, item) => sum + item.passed + item.failed, 0) : null,
      },
      requiredSuites: requiredResults,
      ...(failure ? { failure } : {}),
    };
    if (reportDestination) {
      writeFileSync(reportDestination, JSON.stringify({ ...(report ?? {}), criticalPathEvidence: evidence }, null, 2) + '\n');
    }
    process.stdout.write(`Critical-path evidence: result=${result}; suites=${requiredSuites.length}; collected=${evidence.tests.collected ?? 'unknown'}; executed=${evidence.tests.executed ?? 'unknown'}; passed=${evidence.tests.passed ?? 'unknown'}; failed=${evidence.tests.failed ?? 'unknown'}; skipped=${evidence.tests.skipped ?? 'unknown'}; revision=${source.revision}; source=${source.fingerprint}; worktree=${workingTreeClean ? 'clean' : 'dirty'}${failure ? `; failure=${failure}` : ''}.\n`);
    receiptWritten = true;
  };

  // Vitest file filters alone can succeed when only one of several requested files exists.
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'polutek-critical-path-'));
  try {
    try {
      for (const suite of requiredSuites) {
        let isFile = false;
        try { isFile = statSync(path.resolve(root, suite)).isFile(); } catch { /* handled below */ }
        if (!isFile) throw new Error(`Missing required critical-path suite: ${suite}`);
      }

      const reportPath = path.join(temporary, 'vitest.json');
      child = spawnSync(process.execPath, [
        path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...requiredSuites,
        `--maxWorkers=${maxWorkers}`, '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`,
      ], { cwd: root, env: process.env, stdio: 'inherit' });
      if (child.error) throw child.error;
      try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch { /* included as missing report in receipt */ }
      if (child.signal || child.status !== 0) {
        writeReceipt('FAIL', `Critical-path Vitest failed (exit ${child.status}, signal ${child.signal ?? 'none'}).`);
        throw new Error(`Critical-path Vitest failed (exit ${child.status}, signal ${child.signal ?? 'none'}).`);
      }
      if (report?.success !== true || !Array.isArray(report.testResults)) {
        writeReceipt('FAIL', 'Critical-path report does not confirm success.');
        throw new Error('Critical-path report does not confirm success.');
      }
      for (const suite of requiredSuites) {
        const results = report.testResults.filter(result => typeof result.name === 'string'
          && path.resolve(root, result.name) === path.resolve(root, suite));
        if (results.length !== 1 || !Array.isArray(results[0].assertionResults)
          || results[0].assertionResults.length === 0
          || results[0].assertionResults.some(assertion => assertion.status !== 'passed')) {
          writeReceipt('FAIL', `Required suite must contain only passing tests (no empty, skipped or todo suite): ${suite}`);
          throw new Error(`Required suite must contain only passing tests (no empty, skipped or todo suite): ${suite}`);
        }
      }

      writeReceipt('PASS');
    } catch (error) {
      writeReceipt('FAIL', error instanceof Error ? error.message : String(error));
      throw error;
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

try { run(); } catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
