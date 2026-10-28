import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Hardening of the server scripts (backup.sh, deploy.sh, deploy-admin.sh, mergedeploy.sh).
// 1) Static checks of the script text (run everywhere).
// 2) Behaviour checks in bash with fake `docker`, `flock`, `age`, `rclone`, `tar`, `curl` on PATH. They need a POSIX
//    userland (GNU stat/find/gzip), so they are skipped on win32 unless SERWEREK_BASH_TESTS=1 (Git Bash) is set.
//    Nothing here touches a real server, real Docker or /opt/serwerek.

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const backupSh = read('scripts/serwerek/backup.sh');
const deploySh = read('deploy/serwerek/deploy.sh');
const adminSh = read('deploy/serwerek/deploy-admin.sh');
const mergeSh = read('scripts/ops/mergedeploy.sh');

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

  it('mergedeploy.sh locks before replacing src and recognises the warning outcome', () => {
    const lock = mergeSh.indexOf('flock -n 9');
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(mergeSh.indexOf('rm -rf src'));
    expect(mergeSh).toContain('DEPLOY_LOCK_HELD=1 nohup ./deploy.sh');
    expect(mergeSh).toContain('WITH WARNINGS');
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
        has FAKE_UP_FAIL "$svc" && exit 1
        [ -n "\${FAKE_UP_FAIL_APP_IMAGE:-}" ] && [ "\${APP_IMAGE:-}" = "$FAKE_UP_FAIL_APP_IMAGE" ] && exit 1
        exit 0;;
      ps) for a in "$@"; do svc=$a; done; has FAKE_NO_SERVICE "$svc" || echo "cid-$svc"; exit 0;;
      exec) echo "-- dump"; exit 0;;
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

function sandbox() {
  const dir = mkdtempSync(path.join(tmpdir(), 'serwerek-test-'));
  tmpDirs.push(dir);
  const bin = path.join(dir, 'bin');
  const fake = path.join(dir, 'fake');
  mkdirSync(bin);
  mkdirSync(fake);
  for (const [name, body] of Object.entries({ docker: FAKE_DOCKER, flock: FAKE_FLOCK, age: FAKE_AGE, tar: FAKE_TAR, rclone: FAKE_OK, curl: FAKE_CURL })) {
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
    writeFileSync(path.join(app, 'docker-compose.yml'), 'services: {}\n');
    writeFileSync(path.join(app, 'collector.env'), 'X=1\n');
    if (!extra.noWorkerEnv) writeFileSync(path.join(app, 'worker.env'), 'X=1\n');
    for (const [f, v] of Object.entries(extra.state ?? {})) writeFileSync(path.join(app, f), v);
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
    expect(fk('jobs.log')).toContain('deploy|ok|t1 (build): live on polutek-app:t1');
    expect(fk('flock.log')).toContain('flock -n 9');
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
    expect(fk('jobs.log')).toMatch(/deploy\|ok\|t1 \(build\): live on polutek-app:t1 WITH WARNINGS: encoder not running/);
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
    expect(fk('jobs.log')).toContain('deploy|fail|');
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
