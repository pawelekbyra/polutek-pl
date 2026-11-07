import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const helper = path.join(root, 'scripts/ops/deploy-release.mjs');
const tempDirs: string[] = [];

afterAll(() => { for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true }); });

describe.skipIf(!/^v22\./.test(process.version) || process.platform === 'win32')('deploy release proof consumer', () => {
  it('rejects an unapproved registry reference before invoking Docker', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'deploy-release-test-'));
    tempDirs.push(dir);
    const release = path.join(dir, 'release');
    const source = path.join(release, 'source');
    const bin = path.join(dir, 'bin');
    mkdirSync(source, { recursive: true });
    mkdirSync(bin);
    const dockerLog = path.join(dir, 'docker.log');
    const fakeDocker = path.join(bin, 'docker');
    writeFileSync(fakeDocker, `#!/bin/sh\necho called >> '${dockerLog}'\nexit 0\n`);
    chmodSync(fakeDocker, 0o755);
    const images = Object.fromEntries(['app', 'migrator', 'worker', 'collector', 'admin'].map(kind => [kind, {
      id: `sha256:${'a'.repeat(64)}`,
      registry_ref: kind === 'app' ? 'registry.attacker.invalid/image@sha256:' + 'b'.repeat(64)
        : `ghcr.io/pawelekbyra/polutek-${kind}@sha256:${'b'.repeat(64)}`,
    }]));
    writeFileSync(path.join(release, 'proof.json'), JSON.stringify({ images }));
    writeFileSync(path.join(release, 'inputs.json'), '{}');

    const result = spawnSync(process.execPath, [helper, `--release-dir=${release}`, `--revision=${'c'.repeat(40)}`,
      `--proof-sha256=${'d'.repeat(64)}`, '--scope=app', '--tag=release-test'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not an approved digest');
    expect(existsSync(dockerLog)).toBe(false);
  });

  it('reuses local images only when their IDs match the proof, avoiding registry access', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'deploy-release-cache-'));
    tempDirs.push(dir);
    const release = path.join(dir, 'release');
    const source = path.join(release, 'source', 'scripts', 'ops');
    const bin = path.join(dir, 'bin');
    mkdirSync(source, { recursive: true });
    mkdirSync(bin);
    const revision = 'c'.repeat(40);
    const imageId = `sha256:${'a'.repeat(64)}`;
    const kinds = ['app', 'migrator', 'worker', 'collector', 'admin'];
    const images = Object.fromEntries(kinds.map(kind => [kind, {
      id: imageId,
      registry_ref: `ghcr.io/pawelekbyra/polutek-${kind}@sha256:${'b'.repeat(64)}`,
    }]));
    writeFileSync(path.join(release, 'proof.json'), JSON.stringify({ images }));
    writeFileSync(path.join(release, 'inputs.json'), '{}');
    writeFileSync(path.join(source, 'release-proof.mjs'), `
      const revision = process.argv.find(value => value.startsWith('--revision='))?.slice('--revision='.length);
      const images = Object.fromEntries(['app','migrator','worker','collector','admin'].map(kind => [kind, '${imageId}']));
      process.stdout.write(JSON.stringify(process.argv[2] === 'preflight'
        ? { preflight: true, revision, selected: ['app','migrator','worker','collector'] }
        : { verified: true, revision, images }));
    `);
    const dockerLog = path.join(dir, 'docker.log');
    const fakeDocker = path.join(bin, 'docker');
    writeFileSync(fakeDocker, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${dockerLog}'\ncase "$1" in image) echo "$FAKE_IMAGE_ID";; pull|tag) exit 0;; *) exit 1;; esac\n`);
    chmodSync(fakeDocker, 0o755);

    const result = spawnSync(process.execPath, [helper, `--release-dir=${release}`, `--revision=${revision}`,
      `--proof-sha256=${'d'.repeat(64)}`, '--scope=app', '--tag=release-test'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, FAKE_IMAGE_ID: imageId },
    });

    expect(result.status, result.stderr).toBe(0);
    const calls = readFileSync(dockerLog, 'utf8').trim().split('\n');
    expect(calls.filter(call => call.startsWith('pull '))).toHaveLength(0);
    expect(calls.filter(call => call.startsWith('tag '))).toHaveLength(4);
    expect(calls.filter(call => call.startsWith('image inspect '))).toHaveLength(5);
  });

  it('pulls each approved digest when the cached image ID differs from the proof', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'deploy-release-cache-mismatch-'));
    tempDirs.push(dir);
    const release = path.join(dir, 'release');
    const source = path.join(release, 'source', 'scripts', 'ops');
    const bin = path.join(dir, 'bin');
    mkdirSync(source, { recursive: true });
    mkdirSync(bin);
    const revision = 'c'.repeat(40);
    const imageId = `sha256:${'a'.repeat(64)}`;
    const kinds = ['app', 'migrator', 'worker', 'collector', 'admin'];
    const refs = Object.fromEntries(kinds.map(kind => [kind,
      `ghcr.io/pawelekbyra/polutek-${kind}@sha256:${'b'.repeat(64)}`]));
    const images = Object.fromEntries(kinds.map(kind => [kind, { id: imageId, registry_ref: refs[kind] }]));
    writeFileSync(path.join(release, 'proof.json'), JSON.stringify({ images }));
    writeFileSync(path.join(release, 'inputs.json'), '{}');
    writeFileSync(path.join(source, 'release-proof.mjs'), `
      const revision = process.argv.find(value => value.startsWith('--revision='))?.slice('--revision='.length);
      const images = Object.fromEntries(['app','migrator','worker','collector','admin'].map(kind => [kind, '${imageId}']));
      process.stdout.write(JSON.stringify(process.argv[2] === 'preflight'
        ? { preflight: true, revision, selected: ['app','migrator','worker','collector'] }
        : { verified: true, revision, images }));
    `);
    const dockerLog = path.join(dir, 'docker.log');
    const fakeDocker = path.join(bin, 'docker');
    writeFileSync(fakeDocker, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${dockerLog}'\ncase "$1" in image) echo "sha256:${'e'.repeat(64)}";; pull|tag) exit 0;; *) exit 1;; esac\n`);
    chmodSync(fakeDocker, 0o755);

    const result = spawnSync(process.execPath, [helper, `--release-dir=${release}`, `--revision=${revision}`,
      `--proof-sha256=${'d'.repeat(64)}`, '--scope=app', '--tag=release-test'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` },
    });

    expect(result.status, result.stderr).toBe(0);
    const calls = readFileSync(dockerLog, 'utf8').trim().split('\n');
    expect(calls.filter(call => call.startsWith('pull '))).toEqual(kinds.map(kind => `pull ${refs[kind]}`));
    expect(calls.filter(call => call.startsWith('tag '))).toHaveLength(4);
    expect(calls.filter(call => call.startsWith('image inspect '))).toHaveLength(5);
    expect(Math.max(...calls.map((call, index) => call.startsWith('pull ') ? index : -1)))
      .toBeLessThan(calls.findIndex(call => call.startsWith('tag ')));
  });

  it('rejects a failed proof preflight before invoking Docker or pulling registry images', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'deploy-release-preflight-'));
    tempDirs.push(dir);
    const release = path.join(dir, 'release');
    const source = path.join(release, 'source', 'scripts', 'ops');
    const bin = path.join(dir, 'bin');
    mkdirSync(source, { recursive: true });
    mkdirSync(bin);
    const revision = 'c'.repeat(40);
    const imageId = `sha256:${'a'.repeat(64)}`;
    const kinds = ['app', 'migrator', 'worker', 'collector', 'admin'];
    const images = Object.fromEntries(kinds.map(kind => [kind, {
      id: imageId,
      registry_ref: `ghcr.io/pawelekbyra/polutek-${kind}@sha256:${'b'.repeat(64)}`,
    }]));
    writeFileSync(path.join(release, 'proof.json'), JSON.stringify({ images }));
    writeFileSync(path.join(release, 'inputs.json'), '{}');
    writeFileSync(path.join(source, 'release-proof.mjs'), `
      process.stderr.write('Approved release proof hash mismatch\\n');
      process.exit(1);
    `);
    const dockerLog = path.join(dir, 'docker.log');
    const fakeDocker = path.join(bin, 'docker');
    writeFileSync(fakeDocker, `#!/bin/sh\necho called >> '${dockerLog}'\nexit 0\n`);
    chmodSync(fakeDocker, 0o755);

    const result = spawnSync(process.execPath, [helper, `--release-dir=${release}`, `--revision=${revision}`,
      `--proof-sha256=${'d'.repeat(64)}`, '--scope=app', '--tag=release-test'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Approved release proof hash mismatch');
    expect(existsSync(dockerLog)).toBe(false);
  });
});
