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
