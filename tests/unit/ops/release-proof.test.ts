import { chmodSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { releaseControl } from '../../fixtures/release-control.mjs';
import { captureGitSource, hashJson, safeSourcePath, verifySourceArchive } from '@/scripts/ops/release/source.mjs';
import { IMAGE_KINDS, REQUIRED_GATES, validateInputs, validateQuality } from '@/scripts/ops/release/policy.mjs';
import { createProof, verifyProof } from '@/scripts/ops/release/proof.mjs';

const controls: ReturnType<typeof releaseControl>[] = [];
const fixture = () => { const f = releaseControl(); controls.push(f); return f; };
afterEach(() => { for (const f of controls.splice(0)) rmSync(f.directory, { recursive: true, force: true }); });

describe('release quality evidence (synthetic controls, not product acceptance)', () => {
  it('accepts a complete stable full-strict report and a pristine source archive', () => {
    const f = fixture();
    expect(validateQuality(f.report, f.revision).source.fingerprint).toBe(f.source.fingerprint);
    expect(() => verifySourceArchive(f.archive, f.source)).not.toThrow();
    expect(captureGitSource(f.repo)).toEqual(f.source);
  });

  it.each(REQUIRED_GATES)('rejects a failed %s gate even with global ok=true', id => {
    const f = fixture();
    const report = { ...f.report, results: f.report.results.map(g => g.id === id ? { ...g, status: 'FAIL' } : g) };
    expect(() => validateQuality(report, f.revision)).toThrow('did not pass');
  });

  it.each(REQUIRED_GATES)('rejects a skipped or missing %s gate', id => {
    const f = fixture();
    expect(() => validateQuality({ ...f.report, results: f.report.results.map(g => g.id === id ? { ...g, status: 'SKIP' } : g) }, f.revision)).toThrow();
    expect(() => validateQuality({ ...f.report, results: f.report.results.filter(g => g.id !== id) }, f.revision)).toThrow();
  });

  it('rejects a duplicate gate used to hide another missing gate', () => {
    const f = fixture(); const results = [...f.report.results]; results[1] = results[0];
    expect(() => validateQuality({ ...f.report, results }, f.revision)).toThrow('duplicate');
  });

  it('rejects a different SHA, dirty sources, partial selection and weakened strict mode', () => {
    const f = fixture();
    for (const report of [
      { ...f.report, head: 'f'.repeat(40) }, { ...f.report, dirty: true }, { ...f.report, dirtyAfter: true },
      { ...f.report, sourceStable: false }, { ...f.report, sourceAfter: null },
      { ...f.report, node: 'v18.0.0' }, { ...f.report, failed: ['unit'] }, { ...f.report, strictSkips: ['audit'] },
      { ...f.report, options: { ...f.report.options, strict: false } },
      { ...f.report, options: { ...f.report.options, unitFull: false } },
      { ...f.report, options: { ...f.report.options, lintAll: false } },
      { ...f.report, options: { ...f.report.options, build: false } },
      { ...f.report, options: { ...f.report.options, only: ['unit'] } },
      { ...f.report, options: { ...f.report.options, skip: ['audit'] } },
    ]) expect(() => validateQuality(report, f.revision)).toThrow();
  });

  it('rejects changed sources even when sourceStable was incorrectly true', () => {
    const f = fixture(); writeFileSync(path.join(f.repo, 'app.txt'), 'changed during tests');
    expect(() => validateQuality({ ...f.report, sourceAfter: captureGitSource(f.repo) }, f.revision)).toThrow('snapshots differ');
  });

  it.each(['unit', 'critical-path', 'postgres', 'encode-smoke'])('rejects absent/empty/failed test evidence: %s', id => {
    const f = fixture();
    for (const summary of [null, {}, { success: true, total: 0, passed: 0, files: 0, failed: 0, skipped: 0, failedFiles: [] },
      { success: false, total: 3, passed: 2, files: 1, failed: 1, skipped: 0, failedFiles: ['failed.test.ts'] }]) {
      const results = f.report.results.map(g => g.id === id ? { ...g, testSummary: summary } : g);
      expect(() => validateQuality({ ...f.report, results }, f.revision)).toThrow();
    }
  });

  it('keeps ordinary-suite skips visible but rejects any critical/PG/encoder skip', () => {
    const f = fixture();
    for (const id of ['unit', 'critical-path', 'postgres', 'encode-smoke']) {
      const results = f.report.results.map(g => g.id === id ? { ...g, testSummary: { ...g.testSummary, success: true, total: 3, passed: 2, skipped: 1, failed: 0, files: 1, failedFiles: [] } } : g);
      if (id === 'unit') expect(() => validateQuality({ ...f.report, results }, f.revision)).not.toThrow();
      else expect(() => validateQuality({ ...f.report, results }, f.revision)).toThrow();
    }
  });
});

describe('release source and public build input boundaries', () => {
  it.each(['../secret', '/absolute', 'C:/secret', 'a\\secret', '.git/config', 'a/../secret', 'a//b', 'a\0b'])(
    'refuses unsafe inventory path %s', name => expect(safeSourcePath(name)).toBe(false),
  );

  it('rejects edited/deleted files, extra ignored env files and extra empty directories', () => {
    const f = fixture(); const app = path.join(f.archive, 'app.txt');
    writeFileSync(app, 'changed'); expect(() => verifySourceArchive(f.archive, f.source)).toThrow('changed');
    rmSync(app); expect(() => verifySourceArchive(f.archive, f.source)).toThrow('missing or extra');
    writeFileSync(app, 'control source, not an application\n');
    const env = path.join(f.archive, '.env.local'); writeFileSync(env, 'synthetic control only');
    expect(() => verifySourceArchive(f.archive, f.source)).toThrow('missing or extra'); rmSync(env);
    mkdirSync(path.join(f.archive, 'unexpected')); expect(() => verifySourceArchive(f.archive, f.source)).toThrow('Extra directory');
  });

  it.skipIf(process.platform === 'win32')('rejects a symlink to outside the archive and an executable-mode change', () => {
    const f = fixture(); const app = path.join(f.archive, 'app.txt'); rmSync(app);
    symlinkSync(path.join(f.repo, 'app.txt'), app);
    expect(() => verifySourceArchive(f.archive, f.source)).toThrow('Symlink'); rmSync(app);
    writeFileSync(app, 'control source, not an application\n'); chmodSync(app, 0o755);
    expect(() => verifySourceArchive(f.archive, f.source)).toThrow('mode changed');
  });

  it('rejects mutable bases, unknown/secret argument names and incomplete input sets', () => {
    const f = fixture(); expect(validateInputs(f.inputs)).toBe(hashJson(f.inputs));
    for (const inputs of [
      { ...f.inputs, bases: { ...f.inputs.bases, node: 'node:latest' } },
      { ...f.inputs, public_args: { ...f.inputs.public_args, STRIPE_SECRET_KEY: 'synthetic-control' } },
      { ...f.inputs, public_args: { NEXT_PUBLIC_APP_URL: 'https://example.invalid' } },
      { ...f.inputs, platform: 'unknown' },
    ]) expect(() => validateInputs(inputs)).toThrow();
  });
});

describe.skipIf(process.platform === 'win32')('sealed identities and Docker metadata boundaries (POSIX archive modes)', () => {
  it('seals five identities and verifies selected immutable images', () => {
    const f = fixture(); const inspect = vi.fn(f.inspect);
    const proof = createProof({ ...f, sourceRoot: f.archive }, inspect);
    const images = verifyProof({ proof, proofSha256: hashJson(proof), revision: f.revision, inputs: f.inputs, sourceRoot: f.archive }, inspect);
    expect(Object.keys(images)).toEqual(IMAGE_KINDS);
    for (const kind of IMAGE_KINDS) expect(images[kind]).toBe(f.metadata[kind].Id);
    expect(verifyProof({ proof, proofSha256: hashJson(proof), revision: f.revision, inputs: f.inputs, sourceRoot: f.archive, scope: 'admin' }, inspect)).toEqual({ admin: f.metadata.admin.Id });
  });

  it('rejects changed inputs, SHA and image digest before promotion', () => {
    const f = fixture(); const proof = createProof({ ...f, sourceRoot: f.archive }, f.inspect);
    const options = { proof, proofSha256: hashJson(proof), revision: f.revision, inputs: f.inputs, sourceRoot: f.archive };
    expect(() => verifyProof({ ...options, revision: 'f'.repeat(40) }, f.inspect)).toThrow('revision');
    const inputs = { ...f.inputs, public_args: { ...f.inputs.public_args, NEXT_PUBLIC_APP_NAME: 'changed' } };
    expect(() => verifyProof({ ...options, inputs }, f.inspect)).toThrow('inputs differ');
    f.metadata.app.Id = 'sha256:' + 'e'.repeat(64);
    const inspect = (reference: string) => reference === proof.images.app.id ? f.metadata.app : f.inspect(reference);
    expect(() => verifyProof(options, inspect)).toThrow('identity changed');
  });

  it('rejects an edited manifest or a missing external approval hash before inspecting images', () => {
    const f = fixture(); const proof = createProof({ ...f, sourceRoot: f.archive }, f.inspect);
    const approvedHash = hashJson(proof); const inspect = vi.fn(f.inspect);
    proof.images.app.id = 'sha256:' + 'e'.repeat(64);
    expect(() => verifyProof({ proof, proofSha256: approvedHash, revision: f.revision, inputs: f.inputs, sourceRoot: f.archive }, inspect)).toThrow('proof hash mismatch');
    expect(() => verifyProof({ proof, proofSha256: '', revision: f.revision, inputs: f.inputs, sourceRoot: f.archive }, inspect)).toThrow('proof hash mismatch');
    expect(inspect).not.toHaveBeenCalled();
  });

  it.each(['org.opencontainers.image.revision', 'org.polutek.release.source', 'org.polutek.release.quality', 'org.polutek.release.inputs', 'org.polutek.release.kind'] as const)(
    'rejects a mismatched %s image label', label => {
      const f = fixture(); f.metadata.app.Config.Labels[label] = 'mismatch';
      expect(() => createProof({ ...f, sourceRoot: f.archive }, f.inspect)).toThrow('label mismatch');
    },
  );

  it('rejects the wrong base ancestry or platform', () => {
    const f = fixture(); f.metadata.app.RootFS.Layers = ['sha256:' + 'e'.repeat(64)];
    expect(() => createProof({ ...f, sourceRoot: f.archive }, f.inspect)).toThrow('base ancestry');
    f.metadata.app.Architecture = 'arm64';
    expect(() => createProof({ ...f, sourceRoot: f.archive }, f.inspect)).toThrow('platform');
  });

  it('rejects invalid evidence before any Docker inspection', () => {
    const f = fixture(); const inspect = vi.fn(f.inspect);
    expect(() => createProof({ ...f, sourceRoot: f.archive, report: { ...f.report, ok: false } }, inspect)).toThrow();
    expect(inspect).not.toHaveBeenCalled();
  });

  it('refuses to seal when the source archive changes during image inspection', () => {
    const f = fixture(); let changed = false;
    const inspect = (reference: string) => {
      if (!changed) { changed = true; writeFileSync(path.join(f.archive, 'app.txt'), 'changed while inspecting'); }
      return f.inspect(reference);
    };
    expect(() => createProof({ ...f, sourceRoot: f.archive }, inspect)).toThrow('Source content changed');
  });
});
