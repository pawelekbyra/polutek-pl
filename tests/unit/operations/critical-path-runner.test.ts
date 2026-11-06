import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = process.cwd();
const runner = path.join(root, 'scripts/test-critical-path.mjs');
const restoreSuite = 'tests/unit/operations/verify-restored-database-process.test.ts';
const launchSuite = 'tests/integration/launch-candidate-critical-path.test.ts';
const passing = "import { it, expect } from 'vitest'; it('control', () => expect(1).toBe(1));\n";
const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'polutek-critical-runner-test-'));
  directories.push(directory);
  mkdirSync(path.join(directory, path.dirname(restoreSuite)), { recursive: true });
  mkdirSync(path.join(directory, path.dirname(launchSuite)), { recursive: true });
  symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'junction');
  writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}\n');
  writeFileSync(path.join(directory, 'vitest.config.mjs'), "export default { test: { include: ['tests/**/*.test.ts'] } };\n");
  writeFileSync(path.join(directory, '.gitignore'), 'node_modules\n');
  writeFileSync(path.join(directory, restoreSuite), passing);
  writeFileSync(path.join(directory, launchSuite), passing);
  const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'Test Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Test Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  for (const args of [
    ['init', '-q'],
    ['add', '.gitignore', 'package.json', 'vitest.config.mjs', restoreSuite, launchSuite],
    ['commit', '-qm', 'critical path fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: directory, env: gitEnv, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Could not prepare git fixture: ${result.stderr}`);
  }
  return directory;
}

function run(directory: string, args: string[] = []) {
  const result = spawnSync(process.execPath, [runner, '--maxWorkers=1', ...args], {
    cwd: directory, env: { ...process.env, CI: 'true', NO_COLOR: '1' },
    encoding: 'utf8', timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return { ...result, output: result.stdout + result.stderr };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('critical-path CLI with the real Vitest runner', () => {
  it('requires both suites to execute and writes a receipt only on success', () => {
    const directory = fixture();
    const report = path.join(directory, 'receipt.json');
    const result = run(directory, [`--report-json=${report}`]);
    expect(result.status).toBe(0);
    expect(result.output).toContain('Critical-path evidence: result=PASS; suites=2; collected=2; executed=2; passed=2; failed=0; skipped=0; revision=');
    const receipt = JSON.parse(readFileSync(report, 'utf8'));
    expect(receipt).toMatchObject({ success: true, numPassedTests: 2 });
    expect(receipt.criticalPathEvidence).toMatchObject({
      revision: expect.stringMatching(/^[a-f0-9]{40}$/),
      sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      workingTreeClean: true,
      result: 'PASS',
      tests: { executed: 2, passed: 2, failed: 0, skipped: 0 },
    });
  });

  it('writes SHA and failed/skipped counts when a required suite fails', () => {
    const directory = fixture();
    writeFileSync(path.join(directory, launchSuite), "import { it, expect } from 'vitest'; it('control', () => expect(1).toBe(2));\n");
    const report = path.join(directory, 'failed-receipt.json');
    const result = run(directory, [`--report-json=${report}`]);
    expect(result.status).toBe(1);
    const receipt = JSON.parse(readFileSync(report, 'utf8'));
    expect(receipt.criticalPathEvidence).toMatchObject({
      result: 'FAIL',
      tests: { collected: 2, executed: 2, passed: 1, failed: 1, skipped: 0 },
      requiredSuites: [
        { suite: restoreSuite, tests: 1, passed: 1, failed: 0, skipped: 0 },
        { suite: launchSuite, tests: 1, passed: 0, failed: 1, skipped: 0 },
      ],
    });
    expect(result.output).toContain('Critical-path evidence: result=FAIL; suites=2; collected=2; executed=2; passed=1; failed=1; skipped=0; revision=');
  });

  it('reports skipped counts even though Vitest itself exits successfully', () => {
    const directory = fixture();
    writeFileSync(path.join(directory, launchSuite), passing + "it.skip('not run', () => {});\n");
    const report = path.join(directory, 'skipped-receipt.json');
    const result = run(directory, [`--report-json=${report}`]);
    expect(result.status).toBe(1);
    const receipt = JSON.parse(readFileSync(report, 'utf8'));
    expect(receipt.criticalPathEvidence).toMatchObject({
      result: 'FAIL',
      exitCode: 0,
      tests: { collected: 3, executed: 2, passed: 2, failed: 0, skipped: 1 },
      requiredSuites: [
        { suite: restoreSuite, tests: 1, passed: 1, failed: 0, skipped: 0 },
        { suite: launchSuite, tests: 2, passed: 1, failed: 0, skipped: 1 },
      ],
    });
  });

  it.each(['missing', 'directory'])('rejects a %s target before launching Vitest', scenario => {
    const directory = fixture();
    rmSync(path.join(directory, launchSuite));
    if (scenario === 'directory') mkdirSync(path.join(directory, launchSuite));
    const result = run(directory);
    expect(result.status).toBe(1);
    expect(result.output).toContain(`Missing required critical-path suite: ${launchSuite}`);
    expect(result.output).not.toContain('RUN ');
  });

  it('rejects an existing required suite excluded by the Vitest configuration', () => {
    const directory = fixture();
    writeFileSync(path.join(directory, 'vitest.config.mjs'),
      `export default { test: { include: [${JSON.stringify(restoreSuite)}] } };\n`);
    const result = run(directory);
    expect(result.status).toBe(1);
    expect(result.output).toContain(`Required suite must contain only passing tests (no empty, skipped or todo suite): ${launchSuite}`);
    expect(result.output).not.toContain('Critical-path verified:');
  });

  it.each([
    ['empty', 'export {};'],
    ['all skipped', "import { it } from 'vitest'; it.skip('control', () => {});"],
    ['partially skipped', passing + "it.skip('not executed', () => {});"],
    ['todo', passing + "it.todo('not implemented');"],
    ['failing', "import { it, expect } from 'vitest'; it('control', () => expect(1).toBe(2));"],
  ])('rejects an %s required suite even when the other suite passes', (_name, contents) => {
    const directory = fixture();
    writeFileSync(path.join(directory, launchSuite), contents);
    const result = run(directory);
    expect(result.status).toBe(1);
    expect(result.output).not.toContain('Critical-path verified:');
  });

  it.each(['--passWithNoTests', '--exclude=**/*', '-t=nonexistent', '--maxWorkers=0'])(
    'rejects an option that could bypass the required suites: %s', option => {
      const result = run(fixture(), [option]);
      expect(result.status).toBe(1);
      expect(result.output).toContain('Unsupported critical-path option:');
      expect(result.output).not.toContain('Critical-path verified:');
    },
  );
});
