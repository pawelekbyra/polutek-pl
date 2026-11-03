import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { releaseControl } from '../../fixtures/release-control.mjs';
import { buildRelease } from '../../../scripts/ops/release/build.mjs';

const fixtures: ReturnType<typeof releaseControl>[] = [];
function fixture() { const f = releaseControl(); fixtures.push(f); return f; }
afterEach(() => { for (const f of fixtures.splice(0)) rmSync(f.directory, { recursive: true, force: true }); });

describe('release producer boundary (controlled Docker port)', () => {
  it('stops before any build for a failed required test', () => {
    const f = fixture(); f.report.results.find(g => g.id === 'unit')!.status = 'FAIL';
    const calls: unknown[] = [];
    expect(() => buildRelease({ report: f.report, inputs: f.inputs, revision: f.revision, sourceRoot: f.archive,
      output: path.join(f.directory, 'output') }, (args: string[]) => { calls.push(args); })).toThrow('Required gate did not pass: unit');
    expect(calls).toEqual([]);
  });

  it('stops before Docker on changed sources or mutable base inputs', () => {
    const f = fixture(); let calls = 0;
    const args = { report: f.report, inputs: f.inputs, revision: f.revision, sourceRoot: f.archive, output: path.join(f.directory, 'output') };
    f.inputs.bases.node = 'node:22';
    expect(() => buildRelease(args, () => { calls++; })).toThrow('immutable');
    f.inputs.bases.node = 'node@sha256:' + 'a'.repeat(64);
    writeFileSync(path.join(f.archive, 'app.txt'), 'changed');
    expect(() => buildRelease(args, () => { calls++; })).toThrow('Source content changed');
    expect(calls).toBe(0);
  });

  it('builds all five kinds serially with pinned inputs and seals immutable image IDs', () => {
    const f = fixture(); const calls: string[][] = [];
    const result = buildRelease({ report: f.report, inputs: f.inputs, revision: f.revision, sourceRoot: f.archive,
      output: path.join(f.directory, 'output') }, (args: string[]) => {
      calls.push(args);
      const iid = args[args.indexOf('--iidfile') + 1];
      const kind = path.basename(iid, '.iid');
      writeFileSync(iid, f.metadata[kind].Id);
    }, f.inspect);
    expect(calls).toHaveLength(5);
    expect(calls.map(args => args[args.indexOf('--target') + 1])).toEqual(['runner', 'migrator', 'worker', 'collector', 'admin']);
    for (const args of calls) {
      expect(args).toContain('--load'); expect(args).not.toContain('--push');
      expect(args.at(-1)).toBe(f.archive);
      for (const [key, value] of Object.entries(f.inputs.bases)) {
        expect(args).toContain(`${key.toUpperCase()}_BASE=${value}`);
      }
      expect(args).toContain('NEXT_PUBLIC_SITE_BETA=');
    }
    const proof = JSON.parse(readFileSync(result.path, 'utf8'));
    expect(result.proof_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(proof.images.app.id).toBe(f.metadata.app.Id);
    expect(proof.images.migrator.id).toBe(f.metadata.migrator.Id);
  });

  it('does not seal after a failed build or a malformed image ID', () => {
    const f = fixture();
    const args = { report: f.report, inputs: f.inputs, revision: f.revision, sourceRoot: f.archive, output: path.join(f.directory, 'output') };
    expect(() => buildRelease(args, () => { throw new Error('controlled build failure'); }, f.inspect)).toThrow('controlled build failure');
    expect(() => readFileSync(path.join(args.output, 'proof.json'))).toThrow();
  });

  it('rejects malformed build identity without inspecting or sealing images', () => {
    const f = fixture(); let inspected = false;
    expect(() => buildRelease({ report: f.report, inputs: f.inputs, revision: f.revision, sourceRoot: f.archive,
      output: path.join(f.directory, 'output') }, (args: string[]) => {
        writeFileSync(args[args.indexOf('--iidfile') + 1], 'mutable:tag');
      }, () => { inspected = true; return {}; })).toThrow('immutable image ID');
    expect(inspected).toBe(false);
  });

  it('rejects reusing output and placing output inside the source archive', () => {
    const f = fixture();
    const args = { report: f.report, inputs: f.inputs, revision: f.revision, sourceRoot: f.archive, output: f.archive };
    expect(() => buildRelease(args, () => {})).toThrow('outside');
  });
});
