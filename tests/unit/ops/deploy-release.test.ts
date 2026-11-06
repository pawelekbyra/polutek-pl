import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
});
