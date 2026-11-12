import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Hardening of the server scripts (backup.sh, deploy.sh, deploy-admin.sh, telemetry-enable.sh, mergedeploy.sh).
// 1) Static checks of the script text (run everywhere).
// 2) Behaviour checks in bash with fake `docker`, `flock`, `age`, `rclone`, `tar`, `curl` on PATH. They need a POSIX
//    userland (GNU stat/find/gzip), so they are skipped on win32 unless SERWEREK_BASH_TESTS=1 (Git Bash) is set.
//    Nothing here touches a real server, real Docker or /opt/serwerek.

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const backupSh = read('scripts/serwerek/backup.sh');
const deploySh = read('deploy/serwerek/deploy.sh');
const adminSh = read('deploy/serwerek/deploy-admin.sh');
const verifyActiveSh = read('deploy/serwerek/verify-active-release.sh');
const telemetryEnableSh = read('scripts/serwerek/telemetry-enable.sh');
const mergeSh = read('scripts/ops/mergedeploy.sh');
const composeYml = read('deploy/serwerek/docker-compose.yml');

describe('serwerek scripts: static', () => {
  it('keeps LF line endings', () => {
    for (const s of [backupSh, deploySh, adminSh, mergeSh]) expect(s).not.toContain('\r');
  });

  it('backup.sh requires an explicit, configurable list of databases and writes a manifest', () => {
    expect(backupSh).toContain('BACKUP_REQUIRED_DBS:-polutek-db-1 pp-support-db-1');
    expect(backupSh).toContain('required db container not running');
    expect(backupSh).toContain('gzip -t');
    expect(backupSh).toContain('manifest-$TS.txt');
    expect(backupSh).toContain('sha256sum');
    expect(backupSh).toContain('exit $fail');
    // the age encryption of every file of the run (the manifest included) and the R2 verification stay
    expect(backupSh).toContain('age -r "$AGE_RECIPIENT"');
    expect(backupSh).toContain('rclone check');
  });

  it('deploy scripts take the shared flock and exit 75 when busy', () => {
    for (const s of [deploySh, adminSh]) {
      expect(s).toContain('exec 9>.deploy.lock');
      expect(s).toContain('flock -n 9');
      expect(s).toContain('exit 75');
      expect(s).toContain('DEPLOY_LOCK_HELD');
    }
  });

  it('requires verified release IDs before migration, activation, and every rollback path', () => {
    expect(deploySh).toContain('IMAGE_SOURCE="${IMAGE_SOURCE:-ghcr}"');
    expect(deploySh).toContain('unverified local builds are disabled');
    expect(deploySh.indexOf('deploy-release.mjs')).toBeLessThan(deploySh.indexOf('docker compose --profile tools run --rm migrate'));
    expect(deploySh).toContain('automatic rollback refused');
    expect(adminSh.indexOf('deploy-release.mjs')).toBeLessThan(adminSh.indexOf('if start_admin "$new_image" && wait_healthy "$new_image"; then'));
    expect(adminSh).toContain('automatic rollback refused');
    expect(deploySh).not.toMatch(/^\s*docker build(?:\s|$)/m);
    expect(adminSh).not.toMatch(/^\s*nice -n 10 docker build(?:\s|$)/m);
  });

  it('does not let plain compose activation fall back to mutable current tags', () => {
    for (const kind of ['app', 'worker', 'admin', 'collector', 'migrator']) {
      expect(composeYml).toContain(`polutek-${kind}:proof-required`);
      expect(composeYml).not.toContain(`polutek-${kind}:current`);
    }
  });

  it('verifies the deployed release before telemetry role changes or app/collector activation', () => {
    const verify = telemetryEnableSh.indexOf('verify-active-release.sh app');
    expect(verify).toBeGreaterThan(0);
    expect(verify).toBeLessThan(telemetryEnableSh.indexOf('ALTER ROLE pp_collector'));
    expect(verify).toBeLessThan(telemetryEnableSh.indexOf('docker compose up -d --no-deps collector'));
    expect(telemetryEnableSh).toContain('RELEASE_PROOF_SHA256');
    expect(telemetryEnableSh.indexOf('flock -n 9')).toBeLessThan(telemetryEnableSh.indexOf('ALTER ROLE pp_collector'));
    expect(verifyActiveSh.indexOf('proof.sha256')).toBeLessThan(verifyActiveSh.indexOf('deploy-release.mjs'));
    expect(verifyActiveSh).toContain('externally approved RELEASE_PROOF_SHA256');
    expect(mergeSh).toContain('verify-active-release.sh ./verify-active-release.sh');
  });

  it('mergedeploy.sh requires a completed proof artifact and locks before staging source', () => {
    const lock = mergeSh.indexOf('flock -n 9');
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(mergeSh.indexOf('rm -rf src.previous'));
    expect(mergeSh).toContain('RELEASE_RUN_ID');
    expect(mergeSh).toContain('RELEASE_BUNDLE_DIR');
    expect(mergeSh).toContain('gh run download');
    expect(mergeSh).toContain('release-artifact.mjs');
    expect(mergeSh).toContain('hash proofu nie odpowiada zewnetrznie zatwierdzonemu wynikowi');
    expect(mergeSh).toContain('DEPLOY_LOCK_HELD=1 RELEASE_REVISION=');
    expect(mergeSh).toContain('bash .release-artifacts/${revision}/source/deploy/serwerek/deploy.sh');
    expect(mergeSh).not.toContain('--admin');
    expect(mergeSh.indexOf('deploy wymaga RELEASE_REVISION')).toBeLessThan(mergeSh.indexOf('state=$(gh pr view'));
  });

  it('a failing "compose up" is part of the rollback condition', () => {
    expect(deploySh).toContain('if start_app "$new_image" && wait_healthy "$new_image"; then');
    expect(adminSh).toContain('if start_admin "$new_image" && wait_healthy "$new_image"; then');
  });

  it('image cleanup protects every state file', () => {
    for (const f of ['.current-image', '.previous-image', '.current-worker-image', '.previous-worker-image', '.current-collector-image', '.previous-collector-image']) {
      expect(deploySh).toContain(f);
    }
    expect(deploySh).toContain('"$protected" == *" $repo:$t "*');
  });

  it('the deploy outcome for degraded encoder/collector is not the plain OK line', () => {
    expect(deploySh).toContain('OK (WITH WARNINGS): $new_image is live');
    expect(deploySh).toContain('log "OK: $new_image is live"');
  });
});

const runBash = process.platform !== 'win32' || process.env.SERWEREK_BASH_TESTS === '1';
const posix = (p: string) => p.replace(/\\/g, '/');
const tmpDirs: string[] = [];

describe.skipIf(!runBash)('mergedeploy.sh release preflight', () => {
  it('rejects missing proof inputs before querying or merging a PR', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mergedeploy-preflight-'));
    tmpDirs.push(dir);
    const repo = path.join(dir, 'repo');
    const bin = path.join(dir, 'bin');
    mkdirSync(path.join(repo, 'scripts/ops'), { recursive: true });
    mkdirSync(bin);
    writeFileSync(path.join(repo, 'scripts/ops/mergedeploy.sh'), mergeSh);
    const ghLog = path.join(dir, 'gh.log');
    const fakeGh = path.join(bin, 'gh');
    writeFileSync(fakeGh, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${posix(ghLog)}'\nexit 99\n`);
    chmodSync(fakeGh, 0o755);
    const init = spawnSync('git', ['init', '-q', repo], { encoding: 'utf8' });
    expect(init.status, init.stderr).toBe(0);

    const result = spawnSync('bash', [path.join(repo, 'scripts/ops/mergedeploy.sh'), '123', 'branch', 'release'], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, RELEASE_REVISION: '', RELEASE_PROOF_SHA256: '' },
    });

    expect(result.status, result.stderr).toBe(4);
    expect(result.stderr).toContain('deploy wymaga RELEASE_REVISION');
    expect(existsSync(ghLog)).toBe(false);
  });
});

const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_DIR/docker.log"
has() { case " \${!1:-} " in *" $2 "*) return 0;; esac; return 1; }
case "$1" in
  ps) [ -n "\${FAKE_PS_FAIL:-}" ] && exit 1; cat "$FAKE_DIR/ps.txt" 2>/dev/null; exit 0;;
  exec)
    shift
    if [ "$1" = -i ]; then cat >/dev/null; exit 0; fi
    c=$1; shift
    case "$1" in
      printenv) echo pg; exit 0;;
      pg_dumpall) has FAKE_DUMP_FAIL "$c" && exit 1; has FAKE_DUMP_EMPTY "$c" && exit 0; seq 1 2000; exit 0;;
    esac
    exit 0;;
  images) cat "$FAKE_DIR/images-$2" 2>/dev/null; exit 0;;
  rmi) echo "$2" >> "$FAKE_DIR/rmi.log"; exit 0;;
  inspect)
    fmt=$3; name=\${4#cid-}
    case "$fmt" in
      *State.Health.Status*) if [ -n "\${FAKE_APP_UNHEALTHY:-}" ] && [ "$name" = app ]; then echo unhealthy; else echo healthy; fi;;
      *State.Status*) if has FAKE_EXITED "$name"; then echo exited; else echo running; fi;;
    esac
    exit 0;;
  compose)
    shift
    while [ "\${1:-}" = --profile ]; do shift 2; done
    sub=$1; shift
    case "$sub" in
      up)
        for a in "$@"; do svc=$a; done
        echo "service=$svc app=\${APP_IMAGE:-} admin=\${ADMIN_IMAGE:-}" >> "$FAKE_DIR/up.log"
        has FAKE_UP_FAIL "$svc" && exit 1
        [ -n "\${FAKE_UP_FAIL_APP_IMAGE:-}" ] && [ "\${APP_IMAGE:-}" = "$FAKE_UP_FAIL_APP_IMAGE" ] && exit 1
        [ -n "\${FAKE_UP_FAIL_ADMIN_IMAGE:-}" ] && [ "\${ADMIN_IMAGE:-}" = "$FAKE_UP_FAIL_ADMIN_IMAGE" ] && exit 1
        exit 0;;
      run) [ -n "\${FAKE_MIGRATE_FAIL:-}" ] && exit 1; exit 0;;
      ps) for a in "$@"; do svc=$a; done; has FAKE_NO_SERVICE "$svc" || echo "cid-$svc"; exit 0;;
      exec)
        case " $* " in
          *"select 1 from pg_roles"*) echo "\${FAKE_TELEMETRY_ROLE:-}";;
          *"-v ON_ERROR_STOP=1"*) cat >> "$FAKE_DIR/sql.log";;
          *) [ -n "\${FAKE_DEPLOY_DUMP_FAIL:-}" ] && exit 1; echo "-- dump";;
        esac
        exit 0;;
    esac
    exit 0;;
esac
exit 0
`;
const FAKE_FLOCK = `#!/usr/bin/env bash
echo "flock $*" >> "$FAKE_DIR/flock.log"
[ -n "\${FAKE_FLOCK_BUSY:-}" ] && exit 1
exit 0
`;
const FAKE_AGE = `#!/usr/bin/env bash
out=""; in=""
while [ $# -gt 0 ]; do case "$1" in -r) shift 2;; -o) out=$2; shift 2;; *) in=$1; shift;; esac; done
if [ -n "$in" ]; then cp "$in" "$out"; else cat > "$out"; fi
`;
const FAKE_TAR = `#!/usr/bin/env bash
t=""
while [ $# -gt 0 ]; do case "$1" in czf|-czf) t=$2; shift 2;; *) shift;; esac; done
if [ "$t" = "-" ]; then echo tar-stream; else echo tar-archive > "$t"; fi
`;
const FAKE_OK = `#!/usr/bin/env bash
cat >/dev/null 2>&1 < /dev/null
exit 0
`;
const FAKE_CURL = `#!/usr/bin/env bash
cat >/dev/null
printf '%s' "\${FAKE_HEALTH_BODY:-}"
`;
const FAKE_NODE = `#!/usr/bin/env bash
echo "node $*" >> "$FAKE_DIR/node.log"
[ -n "\${FAKE_NODE_FAIL_VERIFY:-}" ] && exit 1
case " $* " in
  *" --scope=admin "*) echo 'admin=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';;
  *)
    echo 'app=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    echo 'migrator=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    echo 'worker=sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    echo 'collector=sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';;
esac
`;

function sandbox() {
  const dir = mkdtempSync(path.join(tmpdir(), 'serwerek-test-'));
  tmpDirs.push(dir);
  const bin = path.join(dir, 'bin');
  const fake = path.join(dir, 'fake');
  mkdirSync(bin);
  mkdirSync(fake);
  for (const [name, body] of Object.entries({ docker: FAKE_DOCKER, node: FAKE_NODE, flock: FAKE_FLOCK, age: FAKE_AGE, tar: FAKE_TAR, rclone: FAKE_OK, curl: FAKE_CURL })) {
    writeFileSync(path.join(bin, name), body, { mode: 0o755 });
    chmodSync(path.join(bin, name), 0o755);
  }
  return { dir, bin, fake };
}

function runScript(script: string, args: string[], cwd: string, bin: string, fake: string, env: Record<string, string> = {}) {
  return spawnSync('bash', [posix(script), ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      FAKE_DIR: posix(fake),
      ...env,
    },
  });
}

describe.skipIf(!runBash)('verify-active-release.sh', () => {
  function setupActive() {
    const sb = sandbox();
    const app = path.join(sb.dir, 'app');
    const revision = '1111111111111111111111111111111111111111';
    const state = path.join(app, '.release-state', revision);
    mkdirSync(path.join(state, 'source/scripts/ops'), { recursive: true });
    writeFileSync(path.join(app, 'verify-active-release.sh'), verifyActiveSh);
    writeFileSync(path.join(app, '.current-release-revision'), revision);
    writeFileSync(path.join(state, 'proof.sha256'), `${'a'.repeat(64)}\n`);
    writeFileSync(path.join(state, 'proof.json'), '{}\n');
    writeFileSync(path.join(state, 'inputs.json'), '{}\n');
    writeFileSync(path.join(state, 'source/scripts/ops/deploy-release.mjs'), '// fake node handles this invocation\n');
    return { ...sb, app, revision, hash: 'a'.repeat(64) };
  }

  it('re-verifies the active app proof and tags only verifier-returned IDs', () => {
    const sb = setupActive();
    const r = runScript(path.join(sb.app, 'verify-active-release.sh'), ['app'], sb.app, sb.bin, sb.fake, {
      DEPLOY_APP_DIR: posix(sb.app), RELEASE_REVISION: sb.revision, RELEASE_PROOF_SHA256: sb.hash,
    });
    const nodeCalls = existsSync(path.join(sb.fake, 'node.log')) ? readFileSync(path.join(sb.fake, 'node.log'), 'utf8') : '';

    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    expect(r.stdout).toContain('app=sha256:');
    expect(nodeCalls).toContain(`--release-dir=.release-state/${sb.revision}`);
    expect(nodeCalls).toContain('--scope=app');
    expect(nodeCalls).toContain(`--proof-sha256=${sb.hash}`);
  });

  it('refuses a different proof hash before calling the verifier', () => {
    const sb = setupActive();
    const r = runScript(path.join(sb.app, 'verify-active-release.sh'), ['app'], sb.app, sb.bin, sb.fake, {
      DEPLOY_APP_DIR: posix(sb.app), RELEASE_REVISION: sb.revision, RELEASE_PROOF_SHA256: 'b'.repeat(64),
    });
    const nodeLog = path.join(sb.fake, 'node.log');

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('approved proof does not match retained release state');
    expect(existsSync(nodeLog)).toBe(false);
  });

  it('refuses a revision that is not active for the app before calling the verifier', () => {
    const sb = setupActive();
    const r = runScript(path.join(sb.app, 'verify-active-release.sh'), ['app'], sb.app, sb.bin, sb.fake, {
      DEPLOY_APP_DIR: posix(sb.app), RELEASE_REVISION: '2222222222222222222222222222222222222222', RELEASE_PROOF_SHA256: sb.hash,
    });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('requested proof is not the active release');
    expect(existsSync(path.join(sb.fake, 'node.log'))).toBe(false);
  });

  it('rejects admin-scope use when the requested release is not the active admin revision', () => {
    const sb = setupActive();
    const r = runScript(path.join(sb.app, 'verify-active-release.sh'), ['admin'], sb.app, sb.bin, sb.fake, {
      DEPLOY_APP_DIR: posix(sb.app), RELEASE_REVISION: sb.revision, RELEASE_PROOF_SHA256: sb.hash,
    });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('requested proof is not the active release');
    expect(existsSync(path.join(sb.fake, 'node.log'))).toBe(false);
  });
});

describe.skipIf(!runBash)('telemetry-enable.sh proof preflight', () => {
  function setupTelemetry() {
    const sb = sandbox();
    const app = path.join(sb.dir, 'app');
    const revision = '1111111111111111111111111111111111111111';
    const hash = 'a'.repeat(64);
    mkdirSync(path.join(app, '.release-state', revision), { recursive: true });
    writeFileSync(path.join(app, 'telemetry-enable.sh'), telemetryEnableSh);
    writeFileSync(path.join(app, 'verify-active-release.sh'), '#!/usr/bin/env bash\necho called >> "$FAKE_DIR/verify.log"\nexit 1\n', { mode: 0o755 });
    writeFileSync(path.join(app, 'app.env'), 'DATABASE_URL=original\n');
    writeFileSync(path.join(app, 'db.env'), 'POSTGRES_DB=polutek\n');
    writeFileSync(path.join(app, 'docker-compose.yml'), 'services: {}\n');
    writeFileSync(path.join(app, '.current-collector-image'), 'polutek-collector:old');
    writeFileSync(path.join(app, '.current-release-revision'), revision);
    writeFileSync(path.join(app, '.release-state', revision, 'proof.sha256'), `${hash}\n`);
    return { ...sb, app, revision, hash };
  }

  it('does not touch Docker, roles or env files when the retained proof hash differs', () => {
    const sb = setupTelemetry();
    const r = runScript(path.join(sb.app, 'telemetry-enable.sh'), [], sb.app, sb.bin, sb.fake, {
      RELEASE_REVISION: sb.revision, RELEASE_PROOF_SHA256: 'b'.repeat(64),
    });

    expect(r.status).toBe(1);
    expect(r.stdout).toContain('approved proof does not match');
    expect(existsSync(path.join(sb.fake, 'verify.log'))).toBe(false);
    expect(existsSync(path.join(sb.fake, 'docker.log'))).toBe(false);
    expect(readFileSync(path.join(sb.app, 'app.env'), 'utf8')).toBe('DATABASE_URL=original\n');
    expect(existsSync(path.join(sb.app, 'collector.env'))).toBe(false);
  });

  it('does not mutate the database or app config when active proof verification fails', () => {
    const sb = setupTelemetry();
    const r = runScript(path.join(sb.app, 'telemetry-enable.sh'), [], sb.app, sb.bin, sb.fake, {
      RELEASE_REVISION: sb.revision, RELEASE_PROOF_SHA256: sb.hash,
    });

    expect(r.status).toBe(1);
    expect(r.stdout).toContain('release proof verification failed');
    expect(readFileSync(path.join(sb.fake, 'verify.log'), 'utf8')).toContain('called');
    expect(existsSync(path.join(sb.fake, 'docker.log'))).toBe(false);
    expect(readFileSync(path.join(sb.app, 'app.env'), 'utf8')).toBe('DATABASE_URL=original\n');
    expect(existsSync(path.join(sb.app, 'collector.env'))).toBe(false);
  });

  it('activates telemetry only after active proof verification succeeds', () => {
    const sb = setupTelemetry();
    writeFileSync(path.join(sb.app, 'verify-active-release.sh'), '#!/usr/bin/env bash\necho called >> "$FAKE_DIR/verify.log"\nexit 0\n', { mode: 0o755 });
    chmodSync(path.join(sb.app, 'verify-active-release.sh'), 0o755);
    const r = runScript(path.join(sb.app, 'telemetry-enable.sh'), [], sb.app, sb.bin, sb.fake, {
      RELEASE_REVISION: sb.revision, RELEASE_PROOF_SHA256: sb.hash, FAKE_TELEMETRY_ROLE: '1',
    });

    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    expect(readFileSync(path.join(sb.fake, 'verify.log'), 'utf8')).toContain('called');
    expect(readFileSync(path.join(sb.fake, 'sql.log'), 'utf8')).toContain('ALTER ROLE pp_collector LOGIN');
    expect(readFileSync(path.join(sb.fake, 'docker.log'), 'utf8')).toContain('compose up -d --no-deps collector');
    expect(readFileSync(path.join(sb.fake, 'docker.log'), 'utf8')).toContain('compose up -d --no-deps app');
    expect(readFileSync(path.join(sb.app, 'collector.env'), 'utf8')).toContain('TELEMETRY_ALLOWED_HOSTS=www.pawelperfect.com');
    expect(readFileSync(path.join(sb.app, 'app.env'), 'utf8')).toContain('TELEMETRY_COLLECTOR_URL=http://collector:3200');
  });
});

afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

describe.skipIf(!runBash)('backup.sh with fake docker', () => {
  function runBackup(opts: { ps?: string; env?: Record<string, string> } = {}) {
    const sb = sandbox();
    const backups = path.join(sb.dir, 'backups');
    const state = path.join(sb.dir, 'state');
    const log = path.join(sb.dir, 'backup.log');
    const benv = path.join(sb.dir, 'backup.env');
    writeFileSync(benv, 'AGE_RECIPIENT=age1test\nR2_ACCESS_KEY_ID=x\nR2_SECRET_ACCESS_KEY=y\nR2_ENDPOINT=http://localhost\n');
    writeFileSync(path.join(sb.fake, 'ps.txt'), opts.ps ?? 'db-a postgres:17-alpine\ndb-b pgvector/pgvector:pg17\napp polutek-app:1\n');
    const r = runScript(path.join(root, 'scripts/serwerek/backup.sh'), [], sb.dir, sb.bin, sb.fake, {
      BACKUP_DIR: posix(backups),
      BACKUP_LOG: posix(log),
      BACKUP_ENV_FILE: posix(benv),
      SERWEREK_STATE_DIR: posix(state),
      BACKUP_REQUIRED_DBS: 'db-a db-b',
      ...opts.env,
    });
    const logText = existsSync(log) ? readFileSync(log, 'utf8') : '';
    const files = existsSync(backups) ? readdirSync(backups) : [];
    const status = existsSync(path.join(state, 'backup-last')) ? readFileSync(path.join(state, 'backup-last'), 'utf8') : '';
    return { r, logText, files, status, backups };
  }

  it('succeeds when every required database is dumped, with a complete manifest', () => {
    const { r, logText, files, status, backups } = runBackup();
    expect(r.status, logText + r.stderr).toBe(0);
    expect(logText).toContain('pg dump ok: db-a');
    expect(logText).toContain('pg dump ok: db-b');
    expect(status).toMatch(/^\d+ ok /);
    const manifestName = files.find((f) => f.startsWith('manifest-'));
    expect(manifestName).toBeTruthy();
    const manifest = readFileSync(path.join(backups, manifestName!), 'utf8');
    expect(manifest).toContain('complete=yes');
    expect(manifest).toMatch(/pg-db-a-\S+\.sql\.gz \d+ [0-9a-f]{64}/);
    expect(manifest).toMatch(/pg-db-b-\S+\.sql\.gz \d+ [0-9a-f]{64}/);
    expect(manifest).toMatch(/configs-\S+\.tar\.gz \d+ [0-9a-f]{64}/);
    expect(files.filter((f) => f.startsWith('pg-'))).toHaveLength(2);
  });

  it('fails (exit 1, status fail) when a required database container is not running', () => {
    const { r, logText, files, status } = runBackup({ ps: 'db-a postgres:17-alpine\napp polutek-app:1\n' });
    expect(r.status).toBe(1);
    expect(logText).toContain('required db container not running: db-b');
    expect(logText).toContain('required dump MISSING: pg-db-b-');
    expect(files.some((f) => f.startsWith('pg-db-b-'))).toBe(false);
    expect(status).toMatch(/^\d+ fail /);
    expect(files.find((f) => f.startsWith('manifest-'))).toBeTruthy();
  });

  it('fails when pg_dumpall fails, and removes the partial file', () => {
    const { r, logText, files } = runBackup({ env: { FAKE_DUMP_FAIL: 'db-a' } });
    expect(r.status).toBe(1);
    expect(logText).toContain('pg dump FAILED: db-a');
    expect(files.some((f) => f.startsWith('pg-db-a-'))).toBe(false);
  });

  it('fails on an empty dump (non-zero size is not enough)', () => {
    const { r, logText, files } = runBackup({ env: { FAKE_DUMP_EMPTY: 'db-b' } });
    expect(r.status).toBe(1);
    expect(logText).toContain('pg dump FAILED: db-b');
    expect(files.some((f) => f.startsWith('pg-db-b-'))).toBe(false);
  });

  it('fails when Docker is not reachable at all', () => {
    const { r, logText, status } = runBackup({ env: { FAKE_PS_FAIL: '1' } });
    expect(r.status).toBe(1);
    expect(logText).toContain('docker ps failed');
    expect(status).toMatch(/^\d+ fail /);
  });

  it('still dumps an extra running postgres container that is not in the required list', () => {
    const { r, logText } = runBackup({ env: { BACKUP_REQUIRED_DBS: 'db-a' } });
    expect(r.status, logText).toBe(0);
    expect(logText).toContain('pg dump ok: db-b');
  });
});

describe.skipIf(!runBash)('deploy.sh with fake docker', () => {
  function setup(extra: { state?: Record<string, string>; images?: Record<string, string>; noWorkerEnv?: boolean; appEnv?: string } = {}) {
    const sb = sandbox();
    const app = path.join(sb.dir, 'app');
    mkdirSync(app);
    writeFileSync(path.join(app, 'deploy.sh'), deploySh);
    writeFileSync(path.join(app, 'deploy-admin.sh'), adminSh);
    writeFileSync(path.join(app, 'app.env'), extra.appEnv ?? 'HEALTHCHECK_TOKEN=secret-token\n');
    writeFileSync(path.join(app, 'db.env'), 'POSTGRES_USER=u\n');
    writeFileSync(path.join(app, 'admin.env'), 'ADMIN_AUTH_SECRET=test\n', { mode: 0o600 });
    chmodSync(path.join(app, 'admin.env'), 0o600);
    writeFileSync(path.join(app, 'docker-compose.yml'), 'services: {}\n');
    const release = path.join(app, '.release-artifacts', '1111111111111111111111111111111111111111');
    mkdirSync(path.join(release, 'source/scripts/ops'), { recursive: true });
    writeFileSync(path.join(release, 'source/scripts/ops/deploy-release.mjs'), '// test adapter\n');
    writeFileSync(path.join(release, 'proof.json'), '{}\n');
    writeFileSync(path.join(release, 'inputs.json'), '{}\n');
    writeFileSync(path.join(app, 'collector.env'), 'X=1\n');
    if (!extra.noWorkerEnv) writeFileSync(path.join(app, 'worker.env'), 'X=1\n');
    for (const [f, v] of Object.entries(extra.state ?? {})) writeFileSync(path.join(app, f), v);
    if (extra.state?.['.current-image']) {
      const state = path.join(app, '.release-state/1111111111111111111111111111111111111111');
      mkdirSync(path.join(state, 'source/scripts/ops'), { recursive: true });
      writeFileSync(path.join(state, 'source/scripts/ops/deploy-release.mjs'), '// test adapter\n');
      writeFileSync(path.join(state, 'proof.sha256'), 'a'.repeat(64));
      writeFileSync(path.join(app, '.current-release-revision'), '1111111111111111111111111111111111111111');
    }
    for (const [repo, tags] of Object.entries(extra.images ?? {})) writeFileSync(path.join(sb.fake, `images-${repo}`), tags);
    writeFileSync(
      path.join(sb.dir, 'common.sh'),
      'job_run() { printf "%s|%s|%s\\n" "$1" "$2" "$4" >> "$FAKE_DIR/jobs.log"; }\n',
    );
    return { ...sb, app };
  }

  function deploy(sb: ReturnType<typeof setup>, args: string[], env: Record<string, string> = {}, script = 'deploy.sh') {
    const r = runScript(path.join(sb.app, script), args, sb.app, sb.bin, sb.fake, {
      BACKUP_DIR: posix(path.join(sb.dir, 'backups')),
      SERWEREK_COMMON: posix(path.join(sb.dir, 'common.sh')),
      START_SETTLE: '0',
      HEALTH_TIMEOUT: '1',
      RELEASE_REVISION: '1111111111111111111111111111111111111111',
      RELEASE_PROOF_SHA256: 'a'.repeat(64),
      ...env,
    });
    const rd = (f: string) => (existsSync(path.join(sb.app, f)) ? readFileSync(path.join(sb.app, f), 'utf8') : null);
    const fk = (f: string) => (existsSync(path.join(sb.fake, f)) ? readFileSync(path.join(sb.fake, f), 'utf8') : '');
    return { r, out: `${r.stdout}${r.stderr}`, rd, fk };
  }

  const okBody = '{"ok":true,"database":"ok"}';

  it('plain success: "OK: ... is live", state files updated, no warnings', () => {
    const sb = setup({ state: { '.current-image': 'polutek-app:old', '.current-worker-image': 'polutek-worker:old' } });
    const { r, out, rd, fk } = deploy(sb, ['t1'], { FAKE_HEALTH_BODY: okBody });
    expect(r.status, out).toBe(0);
    expect(out).toContain('OK: polutek-app:t1 is live');
    expect(out).not.toContain('WITH WARNINGS');
    expect(rd('.current-image')).toBe('polutek-app:t1');
    expect(rd('.previous-image')).toBe('polutek-app:old');
    expect(rd('.current-worker-image')).toBe('polutek-worker:t1');
    expect(rd('.previous-worker-image')).toBe('polutek-worker:old');
    expect(fk('jobs.log')).toContain('deploy|ok|t1 (ghcr): live on polutek-app:t1');
    expect(fk('flock.log')).toContain('flock -n 9');
  });

  it('refuses an incomplete release bundle before any Docker or migration command', () => {
    const sb = setup();
    rmSync(path.join(sb.app, '.release-artifacts'), { recursive: true, force: true });
    const { r, out, fk } = deploy(sb, ['t1']);
    expect(r.status).toBe(1);
    expect(out).toContain('missing verified release bundle');
    expect(fk('docker.log')).toBe('');
  });

  it('stops before touching Docker when the release proof verifier fails', () => {
    const sb = setup();
    const { r, out, fk } = deploy(sb, ['t1'], { FAKE_NODE_FAIL_VERIFY: '1' });

    expect(r.status).toBe(1);
    expect(out).toContain('release proof verification failed');
    expect(fk('docker.log')).toBe('');
  });

  it('does not activate the app after a migration failure', () => {
    const sb = setup({ state: { '.current-image': 'polutek-app:old' } });
    const { r, out, rd, fk } = deploy(sb, ['t1'], { FAKE_MIGRATE_FAIL: '1' });

    expect(r.status).toBe(1);
    expect(out).toContain('migration failed; app NOT restarted');
    expect(rd('.current-image')).toBe('polutek-app:old');
    expect(fk('up.log')).toContain('service=db');
    expect(fk('up.log')).not.toContain('service=app');
    expect(fk('node.log')).toContain('--scope=app');
  });

  it('does not migrate or activate when the pre-deploy database dump fails', () => {
    const sb = setup({ state: { '.current-image': 'polutek-app:old' } });
    const { r, out, rd, fk } = deploy(sb, ['t1'], { FAKE_DEPLOY_DUMP_FAIL: '1' });

    expect(r.status).toBe(1);
    expect(out).toContain('pre-deploy dump failed');
    expect(rd('.current-image')).toBe('polutek-app:old');
    expect(fk('docker.log')).not.toContain('compose --profile tools run --rm migrate');
    expect(fk('up.log')).not.toContain('service=app');
    expect(readdirSync(path.join(sb.dir, 'backups'))).toEqual([]);
  });

  it('encoder that fails to start: warning outcome, not promoted, logged in telemetry', () => {
    const sb = setup({ state: { '.current-worker-image': 'polutek-worker:old' } });
    const { r, out, rd, fk } = deploy(sb, ['t1'], { FAKE_HEALTH_BODY: okBody, FAKE_UP_FAIL: 'encoder' });
    expect(r.status, out).toBe(0);
    expect(out).toContain('OK (WITH WARNINGS): polutek-app:t1 is live');
    expect(out).not.toContain('OK: polutek-app');
    expect(rd('.current-worker-image')).toBe('polutek-worker:old');
    expect(rd('.previous-worker-image')).toBeNull();
    expect(rd('.current-image')).toBe('polutek-app:t1');
    expect(rd('.current-collector-image')).toBe('polutek-collector:t1');
    expect(fk('jobs.log')).toMatch(/deploy\|ok\|t1 \(ghcr\): live on polutek-app:t1 WITH WARNINGS: encoder not running/);
  });

  it('collector that starts and immediately exits is a warning too', () => {
    const sb = setup();
    const { r, out, rd } = deploy(sb, ['t1'], { FAKE_HEALTH_BODY: okBody, FAKE_EXITED: 'collector' });
    expect(r.status, out).toBe(0);
    expect(out).toContain('OK (WITH WARNINGS)');
    expect(out).toContain('collector not running on polutek-collector:t1');
    expect(rd('.current-collector-image')).toBeNull();
    expect(rd('.current-worker-image')).toBe('polutek-worker:t1');
  });

  it('a deliberately unconfigured encoder (no worker.env) is not a warning and keeps the old state behaviour', () => {
    const sb = setup({ noWorkerEnv: true });
    const { r, out, rd } = deploy(sb, ['t1'], { FAKE_HEALTH_BODY: okBody });
    expect(r.status, out).toBe(0);
    expect(out).toContain('OK: polutek-app:t1 is live');
    expect(rd('.current-worker-image')).toBe('polutek-worker:t1');
  });

  it('readiness warnings: database not confirmed, redis missing', () => {
    const sb = setup();
    const { r, out } = deploy(sb, ['t1'], { FAKE_HEALTH_BODY: '{"ok":false,"database":"failed"}', FAKE_EXITED: 'redis' });
    expect(r.status, out).toBe(0);
    expect(out).toContain('OK (WITH WARNINGS)');
    expect(out).toContain('readiness: database not confirmed');
    expect(out).toContain('redis not running');
    expect(out).not.toContain('secret-token');
  });

  it('a failing "compose up" of the app rolls back to the previous image', () => {
    const sb = setup({ state: { '.current-image': 'polutek-app:old' } });
    const { r, out, rd, fk } = deploy(sb, ['t2'], { FAKE_UP_FAIL_APP_IMAGE: 'polutek-app:t2' });
    expect(r.status).toBe(1);
    expect(out).toContain('rolling back to polutek-app:old');
    expect(out).toContain('rolled back to polutek-app:old');
    expect(rd('.current-image')).toBe('polutek-app:old');
    expect(fk('node.log').match(/--release-dir=\.release-artifacts/g)).toHaveLength(1);
    expect(fk('node.log')).toContain('--release-dir=.release-state/1111111111111111111111111111111111111111');
    expect(fk('up.log')).toContain('app=polutek-app:old');
    expect(fk('jobs.log')).toContain('deploy|fail|');
  });

  it('automatically rolls back the admin image only after verifying the retained proof', () => {
    const revision = '1111111111111111111111111111111111111111';
    const sb = setup({ state: {
      '.current-admin-image': 'polutek-admin:old',
      '.current-admin-release-revision': revision,
    } });
    const state = path.join(sb.app, '.release-state', revision);
    mkdirSync(path.join(state, 'source/scripts/ops'), { recursive: true });
    writeFileSync(path.join(state, 'source/scripts/ops/deploy-release.mjs'), '// test adapter\n');
    writeFileSync(path.join(state, 'proof.sha256'), `${'a'.repeat(64)}\n`);
    const { r, out, rd, fk } = deploy(sb, ['t2'], {
      ADMIN_HOST_STATUS_DIR: posix(path.join(sb.dir, 'host-status')),
      FAKE_UP_FAIL_ADMIN_IMAGE: 'polutek-admin:t2',
    }, 'deploy-admin.sh');

    expect(r.status).toBe(1);
    expect(out).toContain('rolled back to polutek-admin:old');
    expect(fk('node.log')).toContain('--release-dir=.release-artifacts/1111111111111111111111111111111111111111');
    expect(fk('node.log')).toContain('--release-dir=.release-state/1111111111111111111111111111111111111111');
    expect(fk('node.log')).toContain('--scope=admin');
    expect(fk('up.log')).toContain('admin=polutek-admin:t2');
    expect(fk('up.log')).toContain('admin=polutek-admin:old');
    expect(rd('.current-admin-image')).toBe('polutek-admin:old');
  });

  it('admin deploy verifies its proof and activates only the panel', () => {
    const sb = setup();
    writeFileSync(path.join(sb.fake, 'images-polutek-admin'), 't1\n');
    const { r, out, rd, fk } = deploy(sb, ['t1'], {
      ADMIN_HOST_STATUS_DIR: posix(path.join(sb.dir, 'host-status')),
    }, 'deploy-admin.sh');

    expect(r.status, out).toBe(0);
    expect(fk('node.log')).toContain('--scope=admin');
    expect(fk('up.log')).toContain('admin=polutek-admin:t1');
    expect(fk('up.log')).not.toContain('service=app');
    expect(fk('docker.log')).not.toContain('compose --profile tools run --rm migrate');
    expect(rd('.current-admin-image')).toBe('polutek-admin:t1');
    expect(rd('.current-admin-release-revision')).toBe('1111111111111111111111111111111111111111');
  });

  it('admin deploy refuses a bad proof before any Docker activation', () => {
    const sb = setup();
    const { r, out, fk } = deploy(sb, ['t1'], {
      ADMIN_HOST_STATUS_DIR: posix(path.join(sb.dir, 'host-status')),
      FAKE_NODE_FAIL_VERIFY: '1',
    }, 'deploy-admin.sh');

    expect(r.status).toBe(1);
    expect(out).toContain('panel release proof verification failed');
    expect(fk('node.log')).toContain('--scope=admin');
    expect(fk('docker.log')).toBe('');
    expect(fk('up.log')).toBe('');
  });

  it('manual app rollback re-verifies the retained proof before activation', () => {
    const revision = '1111111111111111111111111111111111111111';
    const sb = setup({ state: {
      '.current-image': 'polutek-app:new',
      '.current-release-revision': '2222222222222222222222222222222222222222',
      '.previous-release-revision': revision,
      '.previous-image': 'polutek-app:old',
    } });
    writeFileSync(path.join(sb.app, '.current-release-revision'), '2222222222222222222222222222222222222222');
    const { r, out, rd, fk } = deploy(sb, ['rollback', '--rollback'], { FAKE_HEALTH_BODY: okBody });

    expect(r.status, out).toBe(0);
    expect(out).toContain('rollback to polutek-app:rollback');
    expect(fk('node.log')).toContain(`--release-dir=.release-state/${revision}`);
    expect(fk('node.log')).toContain('--scope=app');
    expect(fk('up.log')).toContain('app=polutek-app:rollback');
    expect(rd('.current-image')).toBe('polutek-app:rollback');
    expect(rd('.current-release-revision')).toBe(revision);
  });

  it('refuses manual app rollback when the externally approved proof hash differs', () => {
    const revision = '1111111111111111111111111111111111111111';
    const sb = setup({ state: { '.current-image': 'polutek-app:new', '.previous-release-revision': revision } });
    const { r, out, fk } = deploy(sb, ['rollback', '--rollback'], { RELEASE_PROOF_SHA256: 'b'.repeat(64) });

    expect(r.status).toBe(1);
    expect(out).toContain('rollback proof hash must match');
    expect(fk('node.log')).toBe('');
    expect(fk('up.log')).toBe('');
  });

  it('manual panel rollback verifies only the retained admin image proof', () => {
    const revision = '1111111111111111111111111111111111111111';
    const sb = setup({ state: {
      '.current-admin-image': 'polutek-admin:new',
      '.current-admin-release-revision': '2222222222222222222222222222222222222222',
      '.previous-admin-release-revision': revision,
      '.previous-admin-image': 'polutek-admin:old',
    } });
    const state = path.join(sb.app, '.release-state', revision);
    mkdirSync(path.join(state, 'source/scripts/ops'), { recursive: true });
    writeFileSync(path.join(state, 'source/scripts/ops/deploy-release.mjs'), '// test adapter\n');
    writeFileSync(path.join(state, 'proof.sha256'), `${'a'.repeat(64)}\n`);
    const { r, out, rd, fk } = deploy(sb, ['rollback', '--rollback'], { ADMIN_HOST_STATUS_DIR: posix(path.join(sb.dir, 'host-status')) }, 'deploy-admin.sh');

    expect(r.status, out).toBe(0);
    expect(fk('node.log')).toContain(`--release-dir=.release-state/${revision}`);
    expect(fk('node.log')).toContain('--scope=admin');
    expect(fk('up.log')).toContain('admin=polutek-admin:rollback');
    expect(rd('.current-admin-image')).toBe('polutek-admin:rollback');
    expect(rd('.current-admin-release-revision')).toBe(revision);
  });

  it('image cleanup keeps the image named by .previous-worker-image', () => {
    const sb = setup({
      state: { '.current-worker-image': 'polutek-worker:t5' },
      images: { 'polutek-worker': 't9\nt8\nt7\nt6\nt5\n' },
    });
    const { r, out, fk } = deploy(sb, ['t10'], { FAKE_HEALTH_BODY: okBody });
    expect(r.status, out).toBe(0);
    const removed = fk('rmi.log');
    expect(removed).toContain('polutek-worker:t6');
    expect(removed).not.toContain('polutek-worker:t5');
  });

  it('exits 75 at once, without touching Docker, when another deploy holds the lock', () => {
    const sb = setup();
    const { r, out, fk } = deploy(sb, ['t1'], { FAKE_FLOCK_BUSY: '1' });
    expect(r.status).toBe(75);
    expect(out).toContain('another deploy is already running');
    expect(fk('docker.log')).toBe('');
    expect(fk('jobs.log')).toBe('');
  });

  it('deploy-admin.sh exits 75 when the lock is busy', () => {
    const sb = setup();
    const { r, out, fk } = deploy(sb, ['t1'], { FAKE_FLOCK_BUSY: '1' }, 'deploy-admin.sh');
    expect(r.status).toBe(75);
    expect(out).toContain('another deploy is already running');
    expect(fk('docker.log')).toBe('');
  });

  it('DEPLOY_LOCK_HELD=1 (lock inherited from mergedeploy.sh) does not lock a second time', () => {
    const sb = setup();
    const { r, out, fk } = deploy(sb, ['t1'], { FAKE_HEALTH_BODY: okBody, DEPLOY_LOCK_HELD: '1', FAKE_FLOCK_BUSY: '1' });
    expect(r.status, out).toBe(0);
    expect(fk('flock.log')).toBe('');
  });
});

// Real flock(1) (Linux only): a held lock makes the second deploy exit 75.
const realFlock = process.platform === 'linux' && spawnSync('flock', ['--version']).status === 0;
describe.skipIf(!realFlock)('deploy.sh with the real flock', () => {
  it('refuses to start while .deploy.lock is held', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'serwerek-flock-'));
    tmpDirs.push(dir);
    writeFileSync(path.join(dir, 'deploy.sh'), deploySh);
    const holder = spawnSync('bash', ['-c', `cd '${dir}' && (flock -n .deploy.lock sleep 5 &) ; sleep 0.5; bash deploy.sh t1; echo "rc=$?"`], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(holder.stdout).toContain('rc=75');
    expect(holder.stderr).toContain('another deploy is already running');
  });
});
