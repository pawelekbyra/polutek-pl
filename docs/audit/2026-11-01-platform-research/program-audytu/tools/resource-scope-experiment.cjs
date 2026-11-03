/** Actual playlist/pipeline use cases and repositories with explicit fake persistence.
 * No Next HTTP, PostgreSQL locks, R2 or generated Prisma client. Does not rerun/replace Vitest.
 * Run from the repository root with Node 22. Every loaded source is checked against the baseline inventory.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = process.cwd();
const baseline = new Map(fs.readFileSync('docs/audit/2026-11-01-platform-research/program-audytu/INWENTARZ-PLIKOW.csv', 'utf8')
  .trim().split(/\r?\n/).slice(1).map(row => { const c = row.split(','); return [c[0], c[4]]; }));
const actual = new Set([
  'lib/modules/shared/app-context.ts', 'lib/modules/shared/app-error.ts', 'lib/modules/shared/result.ts',
  'lib/modules/authz/application/authorize.ts', 'lib/modules/authz/domain/actions.ts',
  'lib/modules/authz/domain/principal.ts', 'lib/modules/authz/domain/policy.ts', 'lib/modules/authz/domain/matrix.ts',
  'lib/modules/playlists/application/playlist-manage.use-cases.ts',
  'lib/modules/playlists/infrastructure/playlist.repository.ts', 'lib/modules/playlists/domain/playlist-rules.ts',
  'tests/unit/modules/playlists/fake-db.ts',
  'lib/modules/channel/application/main-channel.service.ts', 'lib/modules/channel/infrastructure/channel.repository.ts',
  'lib/modules/channel/domain/channel.policy.ts', 'lib/modules/channel/domain/channel.errors.ts',
  'lib/modules/channel/domain/main-channel-setting.ts',
  'lib/modules/video-pipeline/application/encode-queue.use-cases.ts',
  'lib/modules/video-pipeline/application/video-guard.ts',
  'lib/modules/video-pipeline/infrastructure/encode-job.repository.ts',
  'lib/modules/video-pipeline/domain/encode-job.state.ts',
]);
const loaded = new Map(), boundaries = new Set();
const stubs = {
  '@/lib/prisma': () => ({ prisma: {} }),
  '@prisma/client': () => ({}), // Only unused runtime imports on the executed paths; no replacement client.
  '@/lib/modules/authz': () => load('lib/modules/authz/application/authorize.ts'),
  '@/lib/modules/channel': () => load('lib/modules/channel/application/main-channel.service.ts'),
  '@/lib/modules/video': () => ({ assetSizeToNumber: value => value == null ? null : Number(value) }),
  '@/lib/modules/audit': () => ({ recordAuditEvent: async (ctx, event, tx) => (tx ?? ctx.prisma).auditLog.create({ data: event }) }),
};
function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  assert(actual.has(file), `Unapproved module ${file}`);
  const bytes = fs.readFileSync(path.join(root, file));
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, baseline.get(file), `Baseline changed: ${file}`);
  const mod = { exports: {}, sha256: digest };
  loaded.set(file, mod);
  const localRequire = spec => {
    if (stubs[spec]) { boundaries.add(spec); return stubs[spec](); }
    if (spec === 'react') return require(spec);
    const resolved = spec.startsWith('@/') ? `${spec.slice(2)}.ts`
      : `${path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))}.ts`;
    return load(resolved);
  };
  const js = ts.transpileModule(bytes.toString(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
  }).outputText;
  new vm.Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(localRequire, mod, mod.exports);
  return mod.exports;
}
async function main() {
  const f = load('tests/unit/modules/playlists/fake-db.ts');
  const p = load('lib/modules/playlists/application/playlist-manage.use-cases.ts');
  const pipeline = load('lib/modules/video-pipeline/application/encode-queue.use-cases.ts');
  const observations = [];
  async function seed() {
    const state = f.emptyState();
    const row = await p.createPlaylist(f.makeCtx(state, f.owner), { channelId: 'ch-1', title: 'Fixture' });
    assert(row.ok);
    const playlistId = row.data.id;
    for (const videoId of ['v1', 'v2']) assert((await p.addPlaylistVideo(f.makeCtx(state, f.owner), { channelId: 'ch-1', playlistId, videoId })).ok);
    return { state, playlistId };
  }
  const attacks = [
    ['stranger changes own-channel playlist', f.stranger, 'ch-1', 'updatePlaylist', { title: 'Changed' }, 403],
    ['other owner targets foreign playlist via own channel', f.otherOwner, 'ch-2', 'updatePlaylist', { title: 'Changed' }, 404],
    ['other owner deletes foreign playlist via own channel', f.otherOwner, 'ch-2', 'deletePlaylist', {}, 404],
    ['other owner adds to foreign playlist', f.otherOwner, 'ch-2', 'addPlaylistVideo', { videoId: 'x1' }, 404],
    ['other owner removes from foreign playlist', f.otherOwner, 'ch-2', 'removePlaylistVideo', { videoId: 'v1' }, 404],
    ['other owner reorders foreign playlist', f.otherOwner, 'ch-2', 'reorderPlaylist', { videoIds: ['v2', 'v1'] }, 404],
    ['owner adds foreign video to own playlist', f.owner, 'ch-1', 'addPlaylistVideo', { videoId: 'x1' }, 404],
    ['owner replaces order with foreign video', f.owner, 'ch-1', 'reorderPlaylist', { videoIds: ['v1', 'x1'] }, 409],
    ['moderator edits playlist', f.moderator, 'ch-1', 'updatePlaylist', { title: 'Changed' }, 403],
    ['guest edits playlist', f.guest, 'ch-1', 'updatePlaylist', { title: 'Changed' }, 401],
  ];
  for (const [scenario, actor, channelId, operation, extra, expected] of attacks) {
    const { state, playlistId } = await seed();
    const before = JSON.stringify(state);
    const result = await p[operation](f.makeCtx(state, actor), { channelId, playlistId, ...extra });
    assert.equal(result.ok, false, scenario);
    assert.equal(result.error.statusCode, expected, scenario);
    assert.equal(JSON.stringify(state), before, `${scenario}: persistent state changed`);
    observations.push({ scenario, observedStatus: result.error.statusCode, persistentStateUnchanged: true });
  }
  {
    const { state, playlistId } = await seed();
    const result = await p.reorderPlaylist(f.makeCtx(state, f.editor), { channelId: 'ch-1', playlistId, videoIds: ['v2', 'v1'] });
    assert(result.ok);
    observations.push({ scenario: 'positive control: editor reorders own playlist', accepted: true,
      order: [...state.items].sort((a, b) => a.position - b.position).map(i => i.videoId) });
  }
  {
    const { state, playlistId } = await seed();
    const before = JSON.stringify(state);
    await assert.rejects(p.reorderPlaylist(f.makeCtx(state, f.owner, { failSetPositionAfter: 1 }),
      { channelId: 'ch-1', playlistId, videoIds: ['v2', 'v1'] }));
    assert.equal(JSON.stringify(state), before);
    observations.push({ scenario: 'injected failure halfway through reorder', fakeTransactionRolledBack: true,
      limit: 'Fake adapter rollback only; not PostgreSQL transaction/lock proof' });
  }

  const now = new Date('2026-11-01T12:00:00Z');
  const jobs = [{ id: 'job-own', videoId: 'v1', status: 'QUEUED' }, { id: 'job-foreign', videoId: 'x1', status: 'RUNNING' }];
  const state = f.emptyState();
  const db = f.makeDb(state);
  db.channelMember = { findMany: async ({ where }) => (state.channels.find(c => c.id === where.channelId)?.members ?? [])
    .filter(m => m.userId === where.userId) };
  db.video.findFirst = async ({ where }) => state.videos.find(v => v.id === where.id && (!where.creatorId || v.creatorId === where.creatorId)) ?? null;
  db.appSetting = { findUnique: async () => ({ value: 'ch-1' }) };
  db.videoOriginal = { findFirst: async () => null };
  db.videoAsset = { findMany: async () => [], count: async () => 0 };
  db.videoEncodeJob = {
    findFirst: async ({ where }) => jobs.find(j => j.id === where.id && j.videoId === where.videoId) ?? null,
    findMany: async () => [],
    updateMany: async ({ where, data }) => {
      const rows = jobs.filter(j => j.id === where.id && j.status === where.status);
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    },
  };
  const context = actor => ({ prisma: db, actor, channelId: 'ch-1', now: () => now });
  for (const [scenario, input, actor, expected] of [
    ['own video and foreign job ID', { videoId: 'v1', jobId: 'job-foreign' }, f.owner, 404],
    ['foreign video and foreign job ID', { videoId: 'x1', jobId: 'job-foreign' }, f.owner, 404],
    ['moderator cancels own-channel job', { videoId: 'v1', jobId: 'job-own' }, f.moderator, 403],
  ]) {
    const before = JSON.stringify(jobs);
    const auditBefore = state.audit.length;
    const result = await pipeline.cancelEncode(input, context(actor));
    assert.equal(result.ok, false);
    assert.equal(result.error.statusCode, expected);
    assert.equal(JSON.stringify(jobs), before);
    assert.equal(state.audit.length, auditBefore);
    observations.push({ scenario, observedStatus: result.error.statusCode, jobsUnchanged: true, noNewAudit: true });
  }
  const cancel = await pipeline.cancelEncode({ videoId: 'v1', jobId: 'job-own' }, context(f.owner));
  assert(cancel.ok);
  assert.equal(jobs[0].status, 'CANCELLED');
  assert.equal(jobs[1].status, 'RUNNING');
  observations.push({ scenario: 'positive control: owner cancels own job', result: cancel.data.result, foreignJobUnchanged: true });
  for (const [videoId, actor, expected] of [['x1', f.owner, 404], ['v1', f.moderator, 403], ['v1', f.owner, null]]) {
    const result = await pipeline.getPipelineState({ videoId }, context(actor));
    assert.equal(result.ok ? null : result.error.statusCode, expected);
    observations.push({ scenario: `pipeline read ${videoId} by ${actor.userId}`, observedStatus: expected,
      ...(result.ok ? { summary: result.data.summary, limit: 'Fixture with no original, job history or assets' } : {}) });
  }
  console.log(JSON.stringify({ kind: 'ISOLATED_ACTUAL_SOURCE_WITH_FAKE_PERSISTENCE',
    application_baseline_sha: 'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
    actual_source_sha256: Object.fromEntries([...loaded].map(([file, mod]) => [file, mod.sha256])),
    stub_import_boundaries: [...boundaries].sort(),
    limits: 'No HTTP, generated Prisma, real PostgreSQL isolation/locks, provider calls or Next middleware; fake playlist adapter reused from repository tests. Existing Vitest results unchanged.',
    observations }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
