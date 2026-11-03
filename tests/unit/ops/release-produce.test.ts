import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { releaseControl } from '../../fixtures/release-control.mjs';
import { produceRelease } from '../../../scripts/ops/release/produce.mjs';

const fixtures: ReturnType<typeof releaseControl>[] = [];
function fixture() { const f = releaseControl(); fixtures.push(f); return f; }
afterEach(() => { for (const f of fixtures.splice(0)) rmSync(f.directory, { recursive: true, force: true }); });

function ports(f: ReturnType<typeof releaseControl>, mode = 'valid') {
  let builds = 0;
  const calls: { args: string[], cwd: string }[] = [];
  return {
    calls, get builds() { return builds; },
    runCI(args: string[], options: { cwd: string, env: NodeJS.ProcessEnv }) {
      calls.push({ args, cwd: options.cwd });
      if (mode === 'failed') throw new Error('controlled CI failure');
      if (mode === 'stale') return;
      const report = { ...structuredClone(f.report), runId: options.env.POLUTEK_CI_RUN_ID,
        options: { ...f.report.options, only: mode === 'partial' ? ['unit'] : [] } };
      mkdirSync(path.join(f.repo, '.claude'), { recursive: true });
      writeFileSync(path.join(f.repo, '.claude/local-ci-last.json'), JSON.stringify(report));
    },
    build(options: { sourceRoot: string, report: unknown }) {
      builds++;
      expect(readFileSync(path.join(options.sourceRoot, 'app.txt'), 'utf8')).toBe('control source, not an application\n');
      return { sealed: true, revision: f.revision, proof_sha256: 'a'.repeat(64), path: 'controlled-proof-path' };
    },
  };
}

describe('trusted release producer (actual Git archive, controlled CI and Docker ports)', () => {
  it('requires the expected clean checkout before running any controls', () => {
    const f = fixture(); const io = ports(f);
    const options = { root: f.repo, revision: 'f'.repeat(40), inputs: f.inputs, output: path.join(f.directory, 'release') };
    expect(() => produceRelease(options, io)).toThrow('revision');
    options.revision = f.revision; writeFileSync(path.join(f.repo, 'untracked.txt'), 'dirty');
    expect(() => produceRelease(options, io)).toThrow('clean');
    expect(io.calls).toEqual([]); expect(io.builds).toBe(0);
  });

  it.each(['failed', 'stale', 'partial'])('does not build from %s controls', mode => {
    const f = fixture(); const io = ports(f, mode);
    mkdirSync(path.join(f.repo, '.claude')); // An old otherwise valid report cannot be reused.
    writeFileSync(path.join(f.repo, '.claude/local-ci-last.json'), JSON.stringify(f.report));
    expect(() => produceRelease({ root: f.repo, revision: f.revision, inputs: f.inputs,
      output: path.join(f.directory, 'release') }, io)).toThrow();
    expect(io.builds).toBe(0);
  });

  it('runs full strict controls with one worker then builds only the checked Git archive', () => {
    const f = fixture(); const io = ports(f);
    const result = produceRelease({ root: f.repo, revision: f.revision, inputs: f.inputs,
      output: path.join(f.directory, 'release') }, io);
    expect(result.sealed).toBe(true); expect(io.builds).toBe(1);
    expect(io.calls[0].args).toEqual([path.join(f.repo, 'scripts/ops/local-ci.mjs'), '--full', '--strict', '--jobs=1', `--base=${f.revision}`]);
    expect(io.calls[0].cwd).toBe(f.repo);
  });

  it('refuses checked-out source changes during the controls', () => {
    const f = fixture(); const io = ports(f); const runCI = io.runCI;
    io.runCI = (args, options) => { runCI(args, options); writeFileSync(path.join(f.repo, 'app.txt'), 'changed'); };
    expect(() => produceRelease({ root: f.repo, revision: f.revision, inputs: f.inputs,
      output: path.join(f.directory, 'release') }, io)).toThrow('clean');
    expect(io.builds).toBe(0);
  });

  it('rejects option-like revisions before invoking controls', () => {
    const f = fixture(); const io = ports(f);
    expect(() => produceRelease({ root: f.repo, revision: '--worktree-attributes', inputs: f.inputs,
      output: path.join(f.directory, 'release') }, io)).toThrow('revision');
    expect(io.calls).toEqual([]);
  });
});


describe('producer CLI options', () => {
  it.each(['--skip=audit', '--only=unit', '--report=old.json', '--revision=main'])('rejects %s without starting controls', option => {
    const result = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts/ops/release-produce.mjs'), option], { encoding: 'utf8', timeout: 10_000 });
    expect(result.error).toBeUndefined(); expect(result.status).toBe(1);
    expect(result.stdout).toBe(''); expect(result.stderr).toContain('no approved release');
  });
});
