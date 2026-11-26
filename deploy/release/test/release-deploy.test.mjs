// Behaviour tests for release-deploy.sh (rollback safety, .env sync, manifest paths) and the stale work-dir cleanup
// of lib/common.sh. Run: node --test deploy/release/test/*.test.mjs
// Plain node:test + bash with a FAKE `docker` and `curl` on PATH (state in files): nothing touches real Docker,
// /opt/serwerek or Hetzner. Skipped where bash is missing (plain Windows) unless SERWEREK_BASH_TESTS=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(here, '..');
const deployScript = path.join(releaseDir, 'release-deploy.sh');
const hasBash = spawnSync('bash', ['-c', 'command -v flock readlink >/dev/null'], { encoding: 'utf8' }).status === 0;
const skip = !hasBash || (process.platform === 'win32' && process.env.SERWEREK_BASH_TESTS !== '1');
const REV = 'a'.repeat(40);

const FAKE_DOCKER = `#!/usr/bin/env bash
# fake docker: images in $FAKE_DIR/images, healthy images in $FAKE_DIR/healthy, running app image in $FAKE_DIR/running
F="$FAKE_DIR"
case "$1" in
  image)
    shift 2
    for r in "$@"; do grep -qxF -- "$r" "$F/images" || { [ -f "$F/inspect.json" ] && cat "$F/inspect.json"; exit 1; }; done
    if [ -f "$F/inspect.json" ]; then cat "$F/inspect.json"; else echo '[]'; fi; exit 0 ;;
  inspect)
    img="$(cat "$F/running" 2>/dev/null)"
    case "$3" in *Health*) grep -qxF -- "$img" "$F/healthy" && echo healthy || echo unhealthy ;; *) echo running ;; esac
    exit 0 ;;
  compose)
    shift; a="$*"
    case "$a" in
      *"up -d --no-deps app"*) echo "$APP_IMAGE" > "$F/running"; echo "$APP_IMAGE" >> "$F/starts" ;;
      *"ps -q"*) echo cid1 ;;
      *logs*) echo "fake app logs" ;;
      *) echo "$a" >> "$F/compose-other" ;;
    esac
    exit 0 ;;
esac
exit 0
`;
const FAKE_CURL = '#!/usr/bin/env bash\nprintf 200\n';

function sandbox({ images = [], healthy = [], state = {}, running = '' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-deploy-'));
  const app = path.join(dir, 'app');
  const fake = path.join(dir, 'fake');
  const bin = path.join(dir, 'bin');
  for (const d of [app, fake, bin, path.join(dir, 'rbhome')]) mkdirSync(d);
  writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER); chmodSync(path.join(bin, 'docker'), 0o755);
  writeFileSync(path.join(bin, 'curl'), FAKE_CURL); chmodSync(path.join(bin, 'curl'), 0o755);
  writeFileSync(path.join(app, 'app.env'), 'X=1\n');
  writeFileSync(path.join(app, 'docker-compose.yml'), 'services: {}\n');
  writeFileSync(path.join(app, '.env'), 'SRH_TOKEN=keep-me\nAPP_IMAGE=stale:old\n');
  writeFileSync(path.join(fake, 'images'), `${images.join('\n')}\n`);
  writeFileSync(path.join(fake, 'healthy'), `${healthy.join('\n')}\n`);
  if (running) writeFileSync(path.join(fake, 'running'), `${running}\n`);
  for (const [f, v] of Object.entries(state)) writeFileSync(path.join(app, f), v);
  return { dir, app, fake, bin, rbhome: path.join(dir, 'rbhome') };
}

function run(sb, args, { cwd = sb.dir, env = {} } = {}) {
  const r = spawnSync('bash', [deployScript, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${sb.bin}${path.delimiter}${process.env.PATH}`,
      FAKE_DIR: sb.fake, APP_DIR: sb.app, RB_HOME: sb.rbhome, BACKUP_DIR: path.join(sb.dir, 'backups'),
      SERWEREK_COMMON: '/nonexistent', RELEASE_FOREGROUND: '1', HEALTH_TIMEOUT: '1', START_SETTLE: '0',
      RD_MIN_FREE_GB: '0', RD_BACKUP: 'dump', RD_PUBLIC_URL: 'http://127.0.0.1:9/health', ...env,
    },
  });
  const rd = (f) => (existsSync(path.join(sb.app, f)) ? readFileSync(path.join(sb.app, f), 'utf8') : null);
  const fk = (f) => (existsSync(path.join(sb.fake, f)) ? readFileSync(path.join(sb.fake, f), 'utf8') : '');
  return { ...r, out: `${r.stdout}${r.stderr}`, rd, fk };
}

const done = (sb) => rmSync(sb.dir, { recursive: true, force: true });

test('rollback to a broken image: app goes back to the last healthy one, state unchanged, .env in step', { skip }, () => {
  const sb = sandbox({ images: ['app:good', 'app:bad'], healthy: ['app:good'], running: 'app:good',
    state: { '.current-image': 'app:good', '.previous-image': 'app:bad' } });
  try {
    const r = run(sb, ['--rollback']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /rollback to app:bad FAILED \(not healthy\); app is back on app:good \(healthy\)/);
    assert.equal(r.fk('starts'), 'app:bad\napp:good\n');
    assert.equal(r.fk('running').trim(), 'app:good');
    assert.equal(r.rd('.current-image'), 'app:good');
    assert.equal(r.rd('.previous-image'), 'app:bad');
    assert.match(r.rd('.env'), /^SRH_TOKEN=keep-me$/m);
    assert.match(r.rd('.env'), /^APP_IMAGE=app:good$/m);
    assert.doesNotMatch(r.rd('.env'), /stale:old/);
  } finally { done(sb); }
});

test('rollback when nothing is healthy any more: clear SITE DOWN message, exit 1', { skip }, () => {
  const sb = sandbox({ images: ['app:cur', 'app:bad'], healthy: [], running: 'app:cur',
    state: { '.current-image': 'app:cur', '.previous-image': 'app:bad' } });
  try {
    const r = run(sb, ['--rollback']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no healthy image could be restored: SITE DOWN/);
    assert.equal(r.fk('starts'), 'app:bad\napp:cur\n');
  } finally { done(sb); }
});

test('rollback that works: promoted, .env written, exit 0', { skip }, () => {
  const sb = sandbox({ images: ['app:new', 'app:old'], healthy: ['app:new', 'app:old'], running: 'app:new',
    state: { '.current-image': 'app:new', '.previous-image': 'app:old' } });
  try {
    const r = run(sb, ['--rollback']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK: rolled back to app:old/);
    assert.equal(r.rd('.current-image'), 'app:old');
    assert.match(r.rd('.env'), /^APP_IMAGE=app:old$/m);
  } finally { done(sb); }
});

test('rollback to an image that is not on the server changes nothing', { skip }, () => {
  const sb = sandbox({ images: ['app:cur'], healthy: ['app:cur'], running: 'app:cur',
    state: { '.current-image': 'app:cur', '.previous-image': 'app:gone' } });
  try {
    const r = run(sb, ['--rollback']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /image app:gone is not on this server/);
    assert.equal(r.fk('starts'), '');
    assert.match(r.rd('.env'), /APP_IMAGE=stale:old/, '.env untouched when no container was touched');
  } finally { done(sb); }
});

test('relative manifest path: missing file gives a message (was: exit 1, silent)', { skip }, () => {
  const sb = sandbox();
  try {
    const r = run(sb, ['rel/manifest.json', '--check']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no such manifest: rel\/manifest\.json \(from /);
  } finally { done(sb); }
});

test('relative manifest path is resolved against the current directory, not APP_DIR', { skip }, () => {
  const sb = sandbox();
  try {
    mkdirSync(path.join(sb.dir, 'rel'));
    writeFileSync(path.join(sb.dir, 'rel', 'manifest.json'), '{}\n');
    const r = run(sb, ['rel/manifest.json', '--check']);
    assert.equal(r.status, 1, r.out);
    // Reaching the verification means the path was found (no sidecar .sha256 here, so it must fail there).
    assert.match(r.out, /manifest\/images do not verify/);
    assert.doesNotMatch(r.out, /no such manifest/);
  } finally { done(sb); }
});

function makeManifest(sb, tag, appRef) {
  const refs = { app: appRef, migrator: 'mig:1', worker: 'wrk:1', collector: 'col:1' };
  const inspect = Object.values(refs).map((ref, i) => ({ Id: `sha256:${String(i + 1).repeat(64)}`, RepoTags: [ref],
    Config: { Labels: { 'org.opencontainers.image.revision': REV } }, RootFS: { Layers: [] } }));
  const facts = path.join(sb.dir, `facts-${tag}`); mkdirSync(facts);
  writeFileSync(path.join(facts, 'meta.json'), JSON.stringify({ tag, revision: REV, mode: 'full', refs }));
  writeFileSync(path.join(facts, 'inspect-builder.json'), JSON.stringify(inspect));
  writeFileSync(path.join(facts, 'inspect-server.json'), JSON.stringify(inspect));
  writeFileSync(path.join(sb.fake, 'inspect.json'), JSON.stringify(inspect));
  const out = path.join(sb.rbhome, tag); mkdirSync(out, { recursive: true });
  const r = spawnSync('node', [path.join(releaseDir, 'lib', 'manifest.mjs'), 'create', '--facts', facts, '--out', path.join(out, 'manifest.json')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return path.join(out, 'manifest.json');
}

test('deploy of a broken image: automatic rollback to the image that ran before, .env in step', { skip }, () => {
  const sb = sandbox({ images: ['app:new', 'app:old', 'mig:1', 'wrk:1', 'col:1'], healthy: ['app:old'], running: 'app:old',
    state: { '.current-image': 'app:old', '.previous-image': 'app:older' } });
  try {
    const m = makeManifest(sb, 'rel1', 'app:new');
    const r = run(sb, [m]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /release rel1 FAILED, rolled back to app:old/);
    assert.equal(r.fk('running').trim(), 'app:old');
    assert.equal(r.rd('.current-image'), 'app:old');
    assert.match(r.rd('.env'), /^APP_IMAGE=app:old$/m);
  } finally { done(sb); }
});

test('deploy that works writes .env from the state files (sync-env is automatic)', { skip }, () => {
  const sb = sandbox({ images: ['app:new', 'app:old', 'mig:1', 'wrk:1', 'col:1'], healthy: ['app:new', 'app:old'], running: 'app:old',
    state: { '.current-image': 'app:old' } });
  try {
    const m = makeManifest(sb, 'rel2', 'app:new');
    const r = run(sb, [path.relative(sb.dir, m)]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /OK: app:new is live/);
    const env = r.rd('.env');
    assert.match(env, /^SRH_TOKEN=keep-me$/m);
    assert.match(env, /^APP_IMAGE=app:new$/m);
    assert.match(env, /^MIGRATOR_IMAGE=mig:1$/m);
    assert.equal((env.match(/^APP_IMAGE=/gm) || []).length, 1);
  } finally { done(sb); }
});

test('--sync-env writes ADMIN_IMAGE too; without a panel state file the line is left out', { skip }, () => {
  const sb = sandbox({ state: { '.current-image': 'app:1', '.current-admin-image': 'polutek-admin:adm-1' } });
  try {
    writeFileSync(path.join(sb.app, '.env'), 'SRH_TOKEN=keep-me\nADMIN_IMAGE=polutek-admin:old\n');
    let r = run(sb, ['--sync-env']);
    assert.equal(r.status, 0, r.out);
    let env = r.rd('.env');
    assert.match(env, /^SRH_TOKEN=keep-me$/m);
    assert.match(env, /^APP_IMAGE=app:1$/m);
    assert.match(env, /^ADMIN_IMAGE=polutek-admin:adm-1$/m);
    assert.equal((env.match(/^ADMIN_IMAGE=/gm) || []).length, 1);
    assert.doesNotMatch(env, /:old/);
    rmSync(path.join(sb.app, '.current-admin-image'));
    r = run(sb, ['--sync-env']);
    assert.equal(r.status, 0, r.out);
    env = r.rd('.env');
    assert.doesNotMatch(env, /ADMIN_IMAGE/, 'a stale panel line is not kept when nothing is recorded');
    assert.match(env, /^SRH_TOKEN=keep-me$/m);
  } finally { done(sb); }
});

test('rollback keeps the panel line of .env in step with .current-admin-image', { skip }, () => {
  const sb = sandbox({ images: ['app:new', 'app:old'], healthy: ['app:new', 'app:old'], running: 'app:new',
    state: { '.current-image': 'app:new', '.previous-image': 'app:old', '.current-admin-image': 'polutek-admin:adm-7' } });
  try {
    const r = run(sb, ['--rollback']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.rd('.env'), /^ADMIN_IMAGE=polutek-admin:adm-7$/m);
  } finally { done(sb); }
});

// A fake common.sh whose job_run appends "job status" to $FAKE_DIR/jobs (record_job sources $SERWEREK_COMMON).
function withTelemetry(sb) {
  const f = path.join(sb.dir, 'fake-common.sh');
  writeFileSync(f, 'job_run() { printf "%s %s\\n" "$1" "$2" >> "$FAKE_DIR/jobs"; }\n');
  return { SERWEREK_COMMON: f };
}

test('telemetry: --check is job "deploy-check", a rollback stays job "deploy"', { skip }, () => {
  const sb = sandbox({ images: ['app:new', 'app:old', 'mig:1', 'wrk:1', 'col:1'], healthy: ['app:new', 'app:old'], running: 'app:old',
    state: { '.current-image': 'app:old' } });
  try {
    const m = makeManifest(sb, 'rel3', 'app:new');
    const env = withTelemetry(sb);
    let r = run(sb, [m, '--check'], { env });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /CHECK ONLY: nothing changed/);
    assert.equal(r.fk('jobs'), 'deploy-check ok\n');
    assert.equal(r.rd('.current-image'), 'app:old', '--check changed nothing');
    rmSync(path.join(sb.fake, 'jobs'));
    // A check that fails (manifest does not verify) is a failed CHECK, not a failed deploy.
    writeFileSync(`${m}.sha256`, `${'0'.repeat(64)}  manifest.json\n`);
    r = run(sb, [m, '--check'], { env });
    assert.equal(r.status, 1, r.out);
    assert.equal(r.fk('jobs'), 'deploy-check fail\n');
    rmSync(path.join(sb.fake, 'jobs'));
    r = run(sb, ['--rollback'], { env });
    assert.equal(r.status, 1, r.out);
    assert.equal(r.fk('jobs'), 'deploy fail\n', 'a rollback is a deploy row, as before');
  } finally { done(sb); }
});

test('telemetry: a deploy that works is job "deploy"', { skip }, () => {
  const sb = sandbox({ images: ['app:new', 'app:old', 'mig:1', 'wrk:1', 'col:1'], healthy: ['app:new', 'app:old'], running: 'app:old',
    state: { '.current-image': 'app:old' } });
  try {
    const m = makeManifest(sb, 'rel4', 'app:new');
    const r = run(sb, [m], { env: withTelemetry(sb) });
    assert.equal(r.status, 0, r.out);
    assert.equal(r.fk('jobs'), 'deploy ok\n');
  } finally { done(sb); }
});

// --rollback and the release pointers (.current-release / .previous-release under RB_HOME).
const ptr = (sb, f) => (existsSync(path.join(sb.rbhome, f)) ? readFileSync(path.join(sb.rbhome, f), 'utf8') : null);
const setPtr = (sb, f, v) => writeFileSync(path.join(sb.rbhome, f), v);
const twoReleases = (extra = {}) => sandbox({ images: ['app:new', 'app:old', 'mig:1', 'wrk:1', 'col:1'],
  healthy: ['app:new', 'app:old'], running: 'app:new', state: { '.current-image': 'app:new', '.previous-image': 'app:old', ...extra } });

test('rollback to a manifest moves .current-release to it and .previous-release to the release it left', { skip }, () => {
  const sb = twoReleases();
  try {
    const mNew = makeManifest(sb, 'relnew', 'app:new');
    const mOld = makeManifest(sb, 'relold', 'app:old');
    setPtr(sb, '.current-release', mNew);
    const r = run(sb, ['--rollback', mOld]);
    assert.equal(r.status, 0, r.out);
    assert.equal(r.rd('.current-image'), 'app:old');
    assert.equal(ptr(sb, '.current-release'), mOld);
    assert.equal(ptr(sb, '.previous-release'), mNew);
  } finally { done(sb); }
});

test('rollback without an argument (target from .previous-release) swaps the pointers, a second one comes back', { skip }, () => {
  const sb = twoReleases();
  try {
    const mNew = makeManifest(sb, 'relnew', 'app:new');
    const mOld = makeManifest(sb, 'relold', 'app:old');
    setPtr(sb, '.current-release', mNew); setPtr(sb, '.previous-release', mOld);
    let r = run(sb, ['--rollback']);
    assert.equal(r.status, 0, r.out);
    assert.equal(ptr(sb, '.current-release'), mOld);
    assert.equal(ptr(sb, '.previous-release'), mNew);
    r = run(sb, ['--rollback']);
    assert.equal(r.status, 0, r.out);
    assert.equal(r.rd('.current-image'), 'app:new');
    assert.equal(ptr(sb, '.current-release'), mNew);
    assert.equal(ptr(sb, '.previous-release'), mOld);
  } finally { done(sb); }
});

test('rollback to an image without a manifest (old deploy.sh) leaves no pointer on the release that no longer runs', { skip }, () => {
  // The field case of 25.11.2026: running release 50a04594 (manifest), previous image from the old deploy.sh (no manifest).
  const sb = twoReleases();
  try {
    const mNew = makeManifest(sb, 'relnew', 'app:new');
    setPtr(sb, '.current-release', mNew);
    let r = run(sb, ['--rollback']);
    assert.equal(r.status, 0, r.out);
    assert.equal(r.rd('.current-image'), 'app:old');
    assert.equal(ptr(sb, '.current-release'), null, 'no manifest runs now, so no pointer (it used to keep naming the old release)');
    assert.equal(ptr(sb, '.previous-release'), mNew);
    // A plain second `--rollback` must go back to the release it came from (before: back to the same image).
    r = run(sb, ['--rollback']);
    assert.equal(r.status, 0, r.out);
    assert.equal(r.rd('.current-image'), 'app:new');
    assert.equal(ptr(sb, '.current-release'), mNew);
  } finally { done(sb); }
});

test('rollback without an argument finds the manifest of the image by its app ref', { skip }, () => {
  const sb = twoReleases();
  try {
    const mNew = makeManifest(sb, 'relnew', 'app:new');
    const mOld = makeManifest(sb, 'relold', 'app:old');
    setPtr(sb, '.current-release', mNew); // no .previous-release: the target comes from .previous-image
    const r = run(sb, ['--rollback']);
    assert.equal(r.status, 0, r.out);
    assert.equal(ptr(sb, '.current-release'), mOld);
    assert.equal(ptr(sb, '.previous-release'), mNew);
  } finally { done(sb); }
});

test('failed rollback does not move the release pointers', { skip }, () => {
  const sb = sandbox({ images: ['app:new', 'app:bad', 'mig:1', 'wrk:1', 'col:1'], healthy: ['app:new'], running: 'app:new',
    state: { '.current-image': 'app:new', '.previous-image': 'app:bad' } });
  try {
    const mNew = makeManifest(sb, 'relnew', 'app:new');
    const mBad = makeManifest(sb, 'relbad', 'app:bad');
    setPtr(sb, '.current-release', mNew); setPtr(sb, '.previous-release', mBad);
    const r = run(sb, ['--rollback']);
    assert.equal(r.status, 1, r.out);
    assert.equal(ptr(sb, '.current-release'), mNew);
    assert.equal(ptr(sb, '.previous-release'), mBad);
  } finally { done(sb); }
});

test('clean_stale_workdirs: removes dirs of dead builds, keeps running and fresh ones', { skip }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'rb-work-'));
  try {
    const mk = (name, pid, oldHours = 0) => {
      const d = path.join(dir, `release-build.${name}`); mkdirSync(d);
      writeFileSync(path.join(d, 'id'), 'one-time key');
      if (pid !== undefined) writeFileSync(path.join(d, 'pid'), `${pid}\n`);
      if (oldHours) { const t = Date.now() / 1000 - oldHours * 3600; utimesSync(d, t, t); }
      return d;
    };
    const dead = mk('dead', 999999);
    const alive = mk('alive', process.pid);
    const oldNoPid = mk('oldnopid', undefined, 4);
    const freshNoPid = mk('freshnopid');
    const script = `. '${path.join(releaseDir, 'lib', 'common.sh')}'; clean_stale_workdirs "$@"`;
    const env = { ...process.env, RB_WORK_ROOT: dir };
    const dry = spawnSync('bash', ['-c', script, 'x', '--dry-run'], { encoding: 'utf8', env });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /stale work dir: .*release-build\.dead/);
    assert.ok(existsSync(dead), 'dry run deletes nothing');
    const r = spawnSync('bash', ['-c', script, 'x'], { encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(dead), false);
    assert.equal(existsSync(oldNoPid), false);
    assert.equal(existsSync(alive), true);
    assert.equal(existsSync(freshNoPid), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
