import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { releaseControl } from '../../fixtures/release-control.mjs';
import { createProof } from '../../../scripts/ops/release/proof.mjs';
import { hashJson } from '../../../scripts/ops/release/source.mjs';

const root = process.cwd();
const cli = path.join(root, 'scripts/ops/release-proof.mjs');
const controls: ReturnType<typeof releaseControl>[] = [];
function fixture() {
  const f = releaseControl(); controls.push(f);
  const reportPath = path.join(f.directory, 'quality.json');
  writeFileSync(reportPath, JSON.stringify(f.report));
  return { ...f, reportPath };
}
afterEach(() => { for (const f of controls.splice(0)) rmSync(f.directory, { recursive: true, force: true }); });

function run(args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 15_000 });
  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull();
  return { ...result, output: result.stdout + result.stderr };
}

describe('release proof CLI boundary', () => {
  it('checks a complete control report and pristine archive without invoking Docker', () => {
    const f = fixture();
    const result = run(['check-ci', `--report=${f.reportPath}`, `--source=${f.archive}`, `--revision=${f.revision}`]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ verified: true, revision: f.revision, source_fingerprint: f.source.fingerprint });
  });

  it.skipIf(process.platform === 'win32')('preflights the approved proof and source without inspecting images', () => {
    const f = fixture();
    const proof = createProof({ report: f.report, inputs: f.inputs, references: f.references,
      sourceRoot: f.archive, revision: f.revision }, f.inspect);
    const proofPath = path.join(f.directory, 'proof.json');
    const inputsPath = path.join(f.directory, 'inputs.json');
    writeFileSync(proofPath, JSON.stringify(proof));
    writeFileSync(inputsPath, JSON.stringify(f.inputs));
    const result = run(['preflight', `--proof=${proofPath}`, `--proof-sha256=${hashJson(proof)}`,
      `--inputs=${inputsPath}`, `--source=${f.archive}`, `--revision=${f.revision}`, '--scope=app']);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ preflight: true, revision: f.revision,
      selected: ['app', 'migrator', 'worker', 'collector'] });
    expect(run(['preflight', `--proof=${proofPath}`, `--proof-sha256=${'0'.repeat(64)}`,
      `--inputs=${inputsPath}`, `--source=${f.archive}`, `--revision=${f.revision}`, '--scope=app']).status).toBe(1);
  });

  it.each(['--skip=audit', '--only=unit', '--revision=main', '--source=', '--scope=all'])(
    'rejects invalid options in check-ci: %s', option => {
      const f = fixture();
      const result = run(['check-ci', `--report=${f.reportPath}`, `--source=${f.archive}`, `--revision=${f.revision}`, option]);
      expect(result.status).toBe(1); expect(result.output).not.toContain('"verified":true');
    },
  );

  it('rejects malformed JSON without echoing its contents', () => {
    const f = fixture(); writeFileSync(f.reportPath, 'private-synthetic-marker-should-not-be-echoed');
    const result = run(['check-ci', `--report=${f.reportPath}`, `--source=${f.archive}`, `--revision=${f.revision}`]);
    expect(result.status).toBe(1); expect(result.output).toContain('Invalid release JSON');
    expect(result.output).not.toContain('private-synthetic-marker');
  });

  it('does not create a proof from a failed required test', () => {
    const f = fixture(); f.report.results = f.report.results.map(g => g.id === 'unit' ? { ...g, status: 'FAIL' } : g);
    writeFileSync(f.reportPath, JSON.stringify(f.report));
    const out = path.join(f.directory, 'release.json');
    const result = run(['seal', `--report=${f.reportPath}`, `--source=${f.archive}`, `--revision=${f.revision}`, `--out=${out}`]);
    expect(result.status).toBe(1); expect(result.output).toContain('Required gate did not pass: unit');
    expect(existsSync(out)).toBe(false);
  });

  it('does not accept a report from another commit or a changed archive', () => {
    const f = fixture();
    const base = ['check-ci', `--report=${f.reportPath}`, `--source=${f.archive}`];
    expect(run([...base, '--revision=' + 'f'.repeat(40)]).status).toBe(1);
    writeFileSync(path.join(f.archive, 'app.txt'), 'different source');
    expect(run([...base, `--revision=${f.revision}`]).status).toBe(1);
  });

  it.skipIf(process.platform === 'win32')('cannot bypass validation by invoking the CLI through a symlink', () => {
    const f = fixture(); f.report.ok = false; writeFileSync(f.reportPath, JSON.stringify(f.report));
    const alias = path.join(f.directory, 'validator.mjs'); symlinkSync(cli, alias);
    const result = spawnSync(process.execPath, [alias, 'check-ci', `--report=${f.reportPath}`, `--source=${f.archive}`, `--revision=${f.revision}`], { encoding: 'utf8', timeout: 15_000 });
    expect(result.error).toBeUndefined(); expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('"verified":true');
  });
});

describe('real local CI compiler result', () => {
  it('fails on a TypeScript error in .next instead of reporting an ignored-error PASS', () => {
    const f = fixture();
    for (const file of ['scripts/ops/local-ci.mjs', 'scripts/ops/local-ci-lib.mjs',
      'scripts/ops/release/source.mjs', 'scripts/ops/release/policy.mjs', '.github/workflows/ci.yml']) {
      mkdirSync(path.dirname(path.join(f.repo, file)), { recursive: true });
      copyFileSync(path.join(root, file), path.join(f.repo, file));
    }
    mkdirSync(path.join(f.repo, 'node_modules'), { recursive: true });
    mkdirSync(path.join(f.repo, 'node_modules/.bin'));
    symlinkSync(path.join(root, 'node_modules/typescript'), path.join(f.repo, 'node_modules/typescript'), 'junction');
    mkdirSync(path.join(f.repo, '.next'), { recursive: true });
    writeFileSync(path.join(f.repo, '.next/invalid.ts'), 'const value: string = 42;\n');
    writeFileSync(path.join(f.repo, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: [], skipLibCheck: true }, include: ['.next/**/*.ts'] }));
    execFileSync('git', ['-C', f.repo, 'add', '.']);
    execFileSync('git', ['-C', f.repo, '-c', 'user.name=Release Control', '-c', 'user.email=control@example.invalid', 'commit', '--quiet', '-m', 'invalid generated type control']);
    // Isolate the genuine compiler, without generating a client in the shared dependency tree.
    // This filtered/skipped control report is deliberately ineligible for a release proof.
    const result = spawnSync(process.execPath, [path.join(f.repo, 'scripts/ops/local-ci.mjs'), '--only=typecheck-all', '--skip=prisma', '--jobs=1'], {
      cwd: f.repo, encoding: 'utf8', timeout: 30_000,
    });
    expect(result.error).toBeUndefined(); expect(result.status, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(readFileSync(path.join(f.repo, '.claude/local-ci-last.json'), 'utf8'));
    const compilerLog = readFileSync(path.join(f.repo, '.claude/local-ci-logs/typecheck-all.log'), 'utf8');
    expect(compilerLog).toContain('TS2322');
    expect(compilerLog).toContain('.next/invalid.ts');
    expect(report.results.find((g: { id: string }) => g.id === 'typecheck-all'), result.stdout + result.stderr).toMatchObject({ status: 'FAIL' });
    expect(report.ok).toBe(false);
    expect(report.sourceBefore.fingerprint).toBe(report.sourceAfter.fingerprint);
  });
});
