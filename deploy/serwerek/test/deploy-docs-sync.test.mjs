// Tests for the docs sync step of deploy/serwerek/deploy.sh (function sync_docs between the ">>> sync_docs" and
// "<<< sync_docs" markers). Run: node --test deploy/serwerek/test/*.test.mjs
// Plain node:test + bash (GNU find/comm/cmp), no dependencies; not part of the vitest suite. Everything happens in a
// temporary directory: nothing touches /opt/serwerek. Skipped where bash is missing (e.g. plain Windows).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const deploySh = readFileSync(path.join(here, '..', 'deploy.sh'), 'utf8');
const hasBash = spawnSync('bash', ['-c', 'command -v comm find cmp >/dev/null'], { encoding: 'utf8' }).status === 0;
const skip = !hasBash || (process.platform === 'win32' && process.env.SERWEREK_BASH_TESTS !== '1');

function extractSyncDocs() {
  const start = deploySh.indexOf('# >>> sync_docs');
  const end = deploySh.indexOf('# <<< sync_docs');
  assert.ok(start >= 0 && end > start, 'sync_docs markers missing in deploy.sh');
  return deploySh.slice(start, end);
}

function write(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function sandbox() {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-sync-'));
  const src = path.join(dir, 'src');
  const docs = path.join(dir, 'serwerek', 'docs');
  const readme = path.join(dir, 'serwerek', 'README.md');
  // The deployed commit.
  write(path.join(src, 'docs', 'operations', 'STATUS.md'), 'status v2\n');
  write(path.join(src, 'docs', 'operations', 'NEW.md'), 'new in repo\n');
  write(path.join(src, 'CLAUDE.md'), 'claude v2\n');
  write(path.join(src, 'AGENTS.md'), 'agents v2\n');
  write(path.join(src, 'README.md'), 'readme v2\n');
  write(path.join(src, 'deploy', 'serwerek', 'SERVER-README.md'), 'server readme v2\n');
  // What is on the server now: an older copy of a repo file plus files that exist only there.
  write(path.join(docs, 'operations', 'STATUS.md'), 'status v1\n');
  write(path.join(docs, 'CLAUDE.md'), 'claude v1\n');
  write(path.join(docs, 'operations', 'notatka serwerowa.md'), 'only on the server\n');
  write(path.join(docs, 'local', 'deep', 'raport.md'), 'agent report\n');
  return { dir, src, docs, readme };
}

function run(sb, env = {}, srcArg = sb.src) {
  const script = `set -euo pipefail\nlog() { printf '[deploy] %s\\n' "$*"; }\n${extractSyncDocs()}\nsync_docs "$1"\n`;
  const r = spawnSync('bash', ['-c', script, 'sync', srcArg], {
    encoding: 'utf8',
    env: { ...process.env, DOCS_DIR: sb.docs, SERVER_README: sb.readme, ...env },
  });
  return { ...r, out: `${r.stdout}${r.stderr}` };
}

const read = (f) => readFileSync(f, 'utf8');

test('deploy.sh no longer deletes the whole docs directory and calls sync_docs', () => {
  assert.doesNotMatch(deploySh, /rm -rf \/opt\/serwerek\/docs(\s|$)/);
  assert.doesNotMatch(deploySh, /mv \/opt\/serwerek\/docs\.new/);
  assert.match(deploySh, /sync_docs src \|\| log "WARN: docs sync failed \(ignored\)"/);
  assert.doesNotMatch(extractSyncDocs(), /rsync[^\n]*--delete/);
});

test('keep (default): repo files updated, server-only files kept and logged', { skip }, () => {
  const sb = sandbox();
  try {
    const r = run(sb);
    assert.equal(r.status, 0, r.out);
    assert.equal(read(path.join(sb.docs, 'operations', 'STATUS.md')), 'status v2\n');
    assert.equal(read(path.join(sb.docs, 'operations', 'NEW.md')), 'new in repo\n');
    assert.equal(read(path.join(sb.docs, 'CLAUDE.md')), 'claude v2\n');
    assert.equal(read(path.join(sb.docs, 'AGENTS.md')), 'agents v2\n');
    assert.equal(read(path.join(sb.docs, 'README.md')), 'readme v2\n');
    assert.equal(read(sb.readme), 'server readme v2\n');
    // Server-only files survive, untouched.
    assert.equal(read(path.join(sb.docs, 'operations', 'notatka serwerowa.md')), 'only on the server\n');
    assert.equal(read(path.join(sb.docs, 'local', 'deep', 'raport.md')), 'agent report\n');
    assert.match(r.out, /2 file\(s\) in .* are not in the repo \(mode keep\)/);
    assert.match(r.out, /operations\/notatka serwerowa\.md/);
    assert.match(r.out, /local\/deep\/raport\.md/);
    const log = read(`${sb.docs}.sync.log`);
    assert.match(log, /^\d{8}T\d{6}Z keep local\/deep\/raport\.md$/m);
    assert.match(log, /^\d{8}T\d{6}Z keep operations\/notatka serwerowa\.md$/m);
    // No staging directory or archive left behind.
    assert.deepEqual(readdirSync(path.dirname(sb.docs)).filter((n) => n.startsWith('docs.new') || n.startsWith('docs.removed')), []);
  } finally { rmSync(sb.dir, { recursive: true, force: true }); }
});

test('archive: server-only files copied to docs.removed-<time>/ first, then removed from docs', { skip }, () => {
  const sb = sandbox();
  try {
    const r = run(sb, { DOCS_SYNC_MODE: 'archive' });
    assert.equal(r.status, 0, r.out);
    const archives = readdirSync(path.dirname(sb.docs)).filter((n) => n.startsWith('docs.removed-'));
    assert.equal(archives.length, 1, r.out);
    const arch = path.join(path.dirname(sb.docs), archives[0]);
    assert.equal(read(path.join(arch, 'operations', 'notatka serwerowa.md')), 'only on the server\n');
    assert.equal(read(path.join(arch, 'local', 'deep', 'raport.md')), 'agent report\n');
    assert.deepEqual(read(path.join(arch, 'REMOVED.txt')).trim().split('\n').sort(),
      ['local/deep/raport.md', 'operations/notatka serwerowa.md']);
    assert.equal(existsSync(path.join(sb.docs, 'operations', 'notatka serwerowa.md')), false);
    assert.equal(existsSync(path.join(sb.docs, 'local')), false, 'empty directories are removed');
    assert.equal(read(path.join(sb.docs, 'operations', 'STATUS.md')), 'status v2\n');
    assert.match(read(`${sb.docs}.sync.log`), / archive operations\/notatka serwerowa\.md$/m);
  } finally { rmSync(sb.dir, { recursive: true, force: true }); }
});

test('nothing server-only: no log lines, no archive', { skip }, () => {
  const sb = sandbox();
  try {
    rmSync(path.join(sb.docs, 'operations', 'notatka serwerowa.md'));
    rmSync(path.join(sb.docs, 'local'), { recursive: true });
    const r = run(sb, { DOCS_SYNC_MODE: 'archive' });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /0 server-only file\(s\) archived/);
    assert.equal(existsSync(`${sb.docs}.sync.log`), false);
    assert.deepEqual(readdirSync(path.dirname(sb.docs)).filter((n) => n.startsWith('docs.removed')), []);
  } finally { rmSync(sb.dir, { recursive: true, force: true }); }
});

test('first deploy (no docs dir yet) and an unknown mode fall back to keep', { skip }, () => {
  const sb = sandbox();
  try {
    rmSync(sb.docs, { recursive: true });
    const r = run(sb, { DOCS_SYNC_MODE: 'delete' });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /DOCS_SYNC_MODE=delete is unknown, using keep/);
    assert.equal(read(path.join(sb.docs, 'operations', 'STATUS.md')), 'status v2\n');
  } finally { rmSync(sb.dir, { recursive: true, force: true }); }
});

test('no src/docs in the commit: no-op, server docs untouched', { skip }, () => {
  const sb = sandbox();
  try {
    rmSync(path.join(sb.src, 'docs'), { recursive: true });
    const r = run(sb);
    assert.equal(r.status, 0, r.out);
    assert.equal(read(path.join(sb.docs, 'operations', 'STATUS.md')), 'status v1\n');
    assert.equal(read(path.join(sb.docs, 'operations', 'notatka serwerowa.md')), 'only on the server\n');
  } finally { rmSync(sb.dir, { recursive: true, force: true }); }
});

test('a failing copy returns 1 (deploy only warns) and server-only files stay', { skip }, () => {
  const sb = sandbox();
  try {
    // A directory on the server where the commit has a file: the final copy fails.
    rmSync(path.join(sb.docs, 'CLAUDE.md'));
    mkdirSync(path.join(sb.docs, 'CLAUDE.md'));
    write(path.join(sb.docs, 'CLAUDE.md', 'inside.md'), 'x\n');
    const r = run(sb, { DOCS_SYNC_MODE: 'keep' });
    assert.notEqual(r.status, 0, r.out);
    assert.equal(read(path.join(sb.docs, 'operations', 'notatka serwerowa.md')), 'only on the server\n');
    assert.equal(read(path.join(sb.docs, 'CLAUDE.md', 'inside.md')), 'x\n');
    assert.deepEqual(readdirSync(path.dirname(sb.docs)).filter((n) => n.startsWith('docs.new')), []);
  } finally { rmSync(sb.dir, { recursive: true, force: true }); }
});
