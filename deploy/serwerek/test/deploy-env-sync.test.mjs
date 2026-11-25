// Tests for the .env sync hook of deploy/serwerek/deploy.sh (function sync_env_images between the
// ">>> sync_env_images" and "<<< sync_env_images" markers). Run: node --test deploy/serwerek/test/*.test.mjs
// Plain node:test + bash in a temporary directory: nothing touches /opt/serwerek or Docker.
// Skipped where bash is missing (plain Windows) unless SERWEREK_BASH_TESTS=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const deploySh = readFileSync(path.join(here, '..', 'deploy.sh'), 'utf8');
const releaseDeploySh = readFileSync(path.join(here, '..', '..', 'release', 'release-deploy.sh'), 'utf8');
const hasBash = spawnSync('bash', ['-c', 'true'], { encoding: 'utf8' }).status === 0;
const skip = !hasBash || (process.platform === 'win32' && process.env.SERWEREK_BASH_TESTS !== '1');

function fn() {
  const start = deploySh.indexOf('# >>> sync_env_images');
  const end = deploySh.indexOf('# <<< sync_env_images');
  assert.ok(start >= 0 && end > start, 'sync_env_images markers missing in deploy.sh');
  return deploySh.slice(start, end);
}

function run(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'env-sync-'));
  for (const [f, v] of Object.entries(files)) writeFileSync(path.join(dir, f), v);
  const script = `set -euo pipefail\nlog() { printf '[deploy] %s\\n' "$*"; }\n${fn()}\nsync_env_images\n`;
  const r = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8' });
  return { dir, r, out: `${r.stdout}${r.stderr}` };
}

test('deploy.sh calls sync_env_images after a deploy and after a rollback, and records the migrator', () => {
  assert.equal((deploySh.match(/sync_env_images \|\| log "WARN: \.env image lines not updated/g) || []).length, 2);
  assert.match(deploySh, /printf '%s' "\$migrator_image" > \.current-migrator-image/);
  // Same line format and the same set of lines as release-deploy.sh --sync-env (the two must not fight).
  for (const k of ['APP_IMAGE', 'MIGRATOR_IMAGE', 'ENCODER_IMAGE', 'COLLECTOR_IMAGE', '# release-deploy']) {
    assert.ok(fn().includes(k) && releaseDeploySh.includes(k), k);
  }
});

test('rewrites only the image lines, keeps the rest (SRH_TOKEN), mode 600, no value printed', { skip }, () => {
  const { dir, r, out } = run({
    '.env': 'SRH_TOKEN=secret-value\nAPP_IMAGE=polutek-app:old\n# release-deploy: old header\nENCODER_IMAGE=polutek-worker:old\n',
    '.current-image': 'polutek-app:t2r1',
    '.current-migrator-image': 'polutek-migrator:t2r1',
    '.current-worker-image': 'polutek-worker:t2r1',
    '.current-collector-image': 'polutek-collector:t2r1',
  });
  try {
    assert.equal(r.status, 0, out);
    const env = readFileSync(path.join(dir, '.env'), 'utf8');
    assert.match(env, /^SRH_TOKEN=secret-value$/m);
    assert.match(env, /^APP_IMAGE=polutek-app:t2r1$/m);
    assert.match(env, /^MIGRATOR_IMAGE=polutek-migrator:t2r1$/m);
    assert.match(env, /^ENCODER_IMAGE=polutek-worker:t2r1$/m);
    assert.match(env, /^COLLECTOR_IMAGE=polutek-collector:t2r1$/m);
    assert.doesNotMatch(env, /:old/);
    assert.equal((env.match(/^# release-deploy/gm) || []).length, 1);
    assert.equal(statSync(path.join(dir, '.env')).mode & 0o777, 0o600);
    assert.doesNotMatch(out, /secret-value/);
    assert.deepEqual(readdirSync(dir).filter((n) => n.startsWith('.env.')), [], 'no temp file left');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('missing state files: those lines are simply left out; no .env yet: created', { skip }, () => {
  const { dir, r, out } = run({ '.current-image': 'polutek-app:t3r1' });
  try {
    assert.equal(r.status, 0, out);
    const env = readFileSync(path.join(dir, '.env'), 'utf8');
    assert.match(env, /^APP_IMAGE=polutek-app:t3r1$/m);
    assert.doesNotMatch(env, /ENCODER_IMAGE|COLLECTOR_IMAGE|MIGRATOR_IMAGE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
