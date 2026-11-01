/* Research harness: unchanged TypeScript components, explicit fake DB/storage/encoder I/O.
 * No Prisma client is installed or generated, no HTTP/ffmpeg/R2/production is used.
 * Runtime enum strings are read from the pinned schema. The DB models a small subset
 * of transactions and FK cascades; real PostgreSQL cascade evidence is separate.
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = process.cwd();
const base = 'docs/audit/2026-11-01-platform-research/program-audytu';
const hashes = new Map(fs.readFileSync(path.join(root, base, 'INWENTARZ-PLIKOW.csv'), 'utf8')
  .trim().split(/\r?\n/).slice(1).map(line => { const c = line.split(','); return [c[0], c[4]]; }));
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
assert.equal(crypto.createHash('sha256').update(schema).digest('hex'), hashes.get('prisma/schema.prisma'));
const enums = {};
for (const name of ['StorageProvider', 'VideoAssetProcessingState', 'VideoPlaybackRouteStatus', 'VideoPlaybackRouteActivatedBy']) {
  const body = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1];
  enums[name] = Object.fromEntries(body.split('\n').map(s => s.trim()).filter(s => /^[A-Z][A-Z_0-9]*$/.test(s)).map(s => [s, s]));
}
const allowed = new Set([
  'lib/modules/video-pipeline/application/process-encode-job.ts',
  'lib/modules/video-pipeline/application/finalize-self-hls.ts',
  'lib/modules/video-pipeline/application/output-cleanup.use-cases.ts',
  'lib/modules/video-pipeline/application/video-guard.ts',
  'lib/modules/video-pipeline/infrastructure/encode-job.repository.ts',
  'lib/modules/video-pipeline/domain/encode-job.state.ts',
  'lib/modules/video-pipeline/domain/keys.ts',
  'lib/modules/video/application/video-playback-route.service.ts',
  'lib/modules/video/domain/video-asset-selection.ts',
  'lib/modules/video/domain/video-asset.constants.ts',
  'lib/modules/playback/domain/primary-playable-asset.ts',
  'lib/modules/shared/app-context.ts', 'lib/modules/shared/app-error.ts',
  'lib/modules/shared/result.ts',
  'lib/modules/audit/application/record-audit-event.use-case.ts',
  'lib/modules/audit/infrastructure/audit.repository.ts',
]);
const loaded = new Map(), boundaries = new Set();
let db;
const inert = () => { throw new Error('Unconfigured external I/O reached in research harness'); };
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const stubs = {
  '@prisma/client': () => ({ ...enums, Prisma: { JsonNull: null } }),
  '@/lib/prisma': () => ({ prisma: db }),
  '@/lib/logger': () => ({ createScopedLogger: () => logger }),
  '@/lib/modules/audit': () => load('lib/modules/audit/application/record-audit-event.use-case.ts'),
  '@/lib/modules/video': () => ({
    ...load('lib/modules/video/application/video-playback-route.service.ts'),
    attemptPublishAfterAssetReady: async () => {}, syncPublicThumbnailById: async () => {},
  }),
  '@/lib/modules/media': () => ({ R2ThumbnailStorageClient: class { static isConfigured() { return false; } } }),
  '@/lib/modules/channel': () => ({ MainChannelService: { getRequired: async () => ({ id: 'channel', userId: 'owner', status: 'ACTIVE' }) } }),
  '@/lib/modules/authz': () => ({ assertAuthorized: async () => {} }),
  'lib/modules/video-pipeline/infrastructure/r2-storage.ts': () => ({ readR2Credentials: inert, makeR2Client: inert, hlsBucketName: inert }),
  'lib/modules/video-pipeline/infrastructure/r2-multipart.ts': () => ({ OriginalsMultipart: { fromEnv: inert } }),
};
function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  assert(allowed.has(file), `Unapproved source import: ${file}`);
  const bytes = fs.readFileSync(path.join(root, file));
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, hashes.get(file), `Source baseline changed: ${file}`);
  const mod = { exports: {}, sha256: digest }; loaded.set(file, mod);
  const js = ts.transpileModule(bytes.toString(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: file,
  }).outputText;
  const localRequire = spec => {
    const resolved = spec.startsWith('@/') ? spec.slice(2) + '.ts'
      : spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)) + '.ts' : spec;
    const boundary = stubs[spec] ?? stubs[resolved];
    if (boundary) { boundaries.add(spec); return boundary(); }
    if (spec.startsWith('node:')) return require(spec);
    return load(resolved);
  };
  new vm.Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(localRequire, mod, mod.exports);
  return mod.exports;
}
const copy = value => structuredClone(value);
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(w => matches(row, w));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('not' in value) return row[key] !== value.not;
      if ('in' in value) return value.in.includes(row[key]);
      throw new Error(`Unsupported fake DB predicate: ${key}`);
    }
    return row[key] === value;
  });
}
function makeDb({ existing = false, mode = 'control', status = 'PUBLISHED' } = {}) {
  const stamp = new Date('2026-11-01T00:00:00Z');
  const asset = (id, key, primary) => ({ id, videoId: 'video', provider: 'SELF_HLS', objectKey: key,
    processingState: 'READY', isPrimary: primary, createdAt: stamp, updatedAt: stamp });
  const state = { video: { id: 'video', creatorId: 'channel', status, tier: 'PUBLIC', thumbnailUrl: 'custom', duration: '1:00', activePlaybackRouteId: 'route-old' },
    assets: [asset('asset-old', 'videos/video/v/v1', true), ...(existing ? [asset('asset-new', 'videos/video/v/v2', false)] : [])],
    routes: [{ id: 'route-old', videoId: 'video', assetId: 'asset-old', provider: 'SELF_HLS', status: 'ACTIVE' }],
    job: { id: 'job', videoId: 'video', originalId: 'original', versionNumber: 2, attemptCount: 1, maxAttempts: 3, workerId: 'A', status: 'RUNNING', cancelRequested: false },
    events: [], auditAttempts: 0, failAudit: mode === 'audit_failure', failStatusOnce: mode === 'status_failure' };
  const event = op => state.events.push(op);
  function findAsset({ where, select } = {}) {
    const row = state.assets.find(a => matches(a, where));
    if (!row) return null;
    return copy({ ...row, ...(select?.playbackRoutes ? { playbackRoutes: state.routes.filter(r => r.assetId === row.id && r.status === 'ACTIVE').map(r => ({ id: r.id })) } : {}) });
  }
  const client = {
    video: {
      findFirst: async ({ where }) => matches(state.video, where) ? copy(state.video) : null,
      findUnique: async () => copy(state.video),
      update: async ({ data }) => { if (mode === 'transaction_failure') throw new Error('injected transaction write failure'); Object.assign(state.video, data); event('video_pointer_update'); return copy(state.video); },
      updateMany: async ({ where, data }) => { if (!matches(state.video, where)) return { count: 0 }; Object.assign(state.video, data); return { count: 1 }; },
    },
    videoAsset: {
      findFirst: async args => findAsset(args), findUnique: async args => findAsset(args),
      create: async ({ data }) => { const row = { ...asset('asset-new', data.objectKey, false), ...data }; state.assets.push(row); event('asset_create'); return copy(row); },
      updateMany: async ({ where, data }) => { const found = state.assets.filter(a => matches(a, where)); found.forEach(a => Object.assign(a, data)); return { count: found.length }; },
      update: async ({ where, data }) => { const row = state.assets.find(a => matches(a, where)); assert(row); Object.assign(row, data); return copy(row); },
      delete: async ({ where }) => { const row = state.assets.find(a => matches(a, where)); assert(row); state.assets = state.assets.filter(a => a !== row);
        const deleted = state.routes.filter(r => r.assetId === row.id).map(r => r.id);
        state.routes = state.routes.filter(r => !deleted.includes(r.id));
        if (deleted.includes(state.video.activePlaybackRouteId)) state.video.activePlaybackRouteId = null;
        event('asset_delete_and_modeled_fk_cascade'); return copy(row); },
    },
    videoPlaybackRoute: {
      findFirst: async ({ where }) => copy(state.routes.find(r => matches(r, where)) ?? null),
      updateMany: async ({ where, data }) => { const found = state.routes.filter(r => matches(r, where)); found.forEach(r => Object.assign(r, data)); event('routes_demoted'); return { count: found.length }; },
      create: async ({ data }) => { const row = { id: 'route-new', ...data }; state.routes.push(row); event('route_create'); return copy(row); },
    },
    videoEncodeJob: {
      findUnique: async () => copy(state.job),
      updateMany: async ({ where, data }) => { if (!matches(state.job, where)) { event('job_write_rejected'); return { count: 0 }; }
        if (state.failStatusOnce && data.status === 'SUCCEEDED') { state.failStatusOnce = false; event('status_write_error'); throw new Error('injected success status write failure'); }
        Object.assign(state.job, data); return { count: 1 }; },
    },
    auditLog: { create: async ({ data }) => { state.auditAttempts++; event('audit_attempt:' + data.action); if (state.failAudit) throw new Error('injected audit insert failure'); return { id: 'audit' }; } },
    $transaction: async fn => { const snapshot = copy({ video: state.video, assets: state.assets, routes: state.routes });
      event('tx_begin'); try { const result = await fn(client); event('tx_commit'); return result; }
      catch (error) { Object.assign(state, snapshot); event('tx_rollback'); throw error; } },
  };
  return { client, state };
}
function snapshot(state, objects) {
  const selected = load('lib/modules/video/domain/video-asset-selection.ts').selectPrimaryVideoAsset(state.assets);
  const fallback = load('lib/modules/playback/domain/primary-playable-asset.ts').getPrimaryPlayableAsset(selected);
  return { active_route_id: state.video.activePlaybackRouteId,
    assets: state.assets.map(a => ({ id: a.id, isPrimary: a.isPrimary })),
    routes: state.routes.map(r => ({ id: r.id, status: r.status, assetId: r.assetId })),
    new_prefix_objects: [...objects].filter(k => k.startsWith('videos/video/v/v2/')).length,
    old_prefix_objects: [...objects].filter(k => k.startsWith('videos/video/v/v1/')).length,
    job_status: state.job.status, job_worker: state.job.workerId,
    selected_fallback_id: selected?.id ?? null, fallback_eligibility: fallback.state };
}
async function pipelineCase(name, options = {}) {
  const { client, state } = makeDb(options); db = client;
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'polutek-pipeline-boundaries-'));
  const objects = new Set(['videos/video/v/v1/master.m3u8']);
  const storageCalls = { put: 0, exists: 0, count: 0, delete: 0 };
  const processor = load('lib/modules/video-pipeline/application/process-encode-job.ts').processEncodeJob;
  const store = new (load('lib/modules/video-pipeline/infrastructure/encode-job.repository.ts').EncodeJobRepository)(client);
  const finalizer = load('lib/modules/video-pipeline/application/finalize-self-hls.ts').createSelfHlsFinalizer(client);
  const ports = { workerId: 'A', workRoot: dir, now: () => new Date('2026-11-01T00:00:00Z'), heartbeatIntervalMs: 1_000_000,
    store, finalizer, audit: async () => {}, log() {},
    originals: { loadOriginal: async () => ({ objectKey: 'original.mp4', sizeBytes: 1 }), download: async () => 1 },
    encoder: { probe: async () => ({ width: 640, height: 360, duration: 5, hdr: false, hasAudio: false }),
      encode: async ({ out }) => { await fsp.mkdir(path.join(out, '360p'), { recursive: true });
        for (const file of ['master.m3u8', '360p/index.m3u8', '360p/init.mp4', '360p/seg.m4s', 'poster.jpg']) await fsp.writeFile(path.join(out, file), 'fixture');
        return { meta: { source: { durationSeconds: 5 } }, issues: [] }; } },
    hls: { bucket: 'fake-local-storage', putFile: async key => { storageCalls.put++; objects.add(key); return 7; }, exists: async key => { storageCalls.exists++; return objects.has(key); },
      countPrefix: async prefix => { storageCalls.count++; const count = [...objects].filter(k => k.startsWith(prefix)).length;
        if (options.mode === 'lost_claim') { state.job.workerId = 'B'; state.events.push('simulated_claim_reassigned_to_B'); }
        return count; },
      deletePrefix: async prefix => { storageCalls.delete++; state.events.push('storage_delete:' + prefix); let count = 0; for (const key of objects) if (key.startsWith(prefix)) { objects.delete(key); count++; } return count; } },
  };
  try {
    const outcome = await processor(copy(state.job), ports);
    const after = snapshot(state, objects);
    let retry = null;
    if (options.retry) {
      state.failAudit = false; Object.assign(state.job, { status: 'RUNNING', workerId: 'A', attemptCount: 2 });
      const eventStart = state.events.length, storageBefore = copy(storageCalls);
      const retryOutcome = await processor(copy(state.job), ports);
      retry = { outcome: retryOutcome, state: snapshot(state, objects), events: state.events.slice(eventStart),
        storage_calls: Object.fromEntries(Object.keys(storageCalls).map(key => [key, storageCalls[key] - storageBefore[key]])) };
      assert.deepEqual(retry.storage_calls, { put: 0, exists: 0, count: 0, delete: 0 });
    }
    if (name === 'pipeline_control') { assert.equal(outcome, 'succeeded'); assert.equal(after.new_prefix_objects, 5); assert.equal(after.active_route_id, 'route-new'); }
    if (name === 'audit_failure_new_asset') { assert.equal(outcome, 'retry'); assert.equal(after.active_route_id, null); assert.equal(after.new_prefix_objects, 0); assert.equal(after.fallback_eligibility, 'NO_PRIMARY_ASSET'); }
    if (name === 'audit_failure_existing_asset_then_retry') { assert.equal(outcome, 'retry'); assert.equal(after.active_route_id, 'route-new'); assert.equal(after.new_prefix_objects, 0); assert.equal(retry.outcome, 'succeeded'); assert.equal(retry.state.new_prefix_objects, 0); assert(!retry.events.some(e => e.startsWith('storage_delete:'))); }
    if (name === 'post_finalize_status_error_control') { assert.equal(outcome, 'retry'); assert.equal(after.active_route_id, 'route-new'); assert.equal(after.new_prefix_objects, 5); }
    if (name === 'activation_transaction_error_control') { assert.equal(outcome, 'retry'); assert.equal(after.active_route_id, 'route-old'); assert.equal(after.new_prefix_objects, 0); assert.equal(after.fallback_eligibility, 'READY'); }
    if (name === 'lost_claim_actual_finalizer') { assert.equal(outcome, 'lost'); assert.equal(after.active_route_id, 'route-new'); assert.equal(after.job_worker, 'B'); assert.equal(after.job_status, 'RUNNING'); assert(state.events.includes('job_write_rejected')); }
    return { name, kind: 'ACTUAL_COMPONENTS_FAKE_IO', outcome, state: after, retry, events: state.events, storage_calls_total: storageCalls };
  } finally { await fsp.rm(dir, { recursive: true, force: true }); }
}
async function cleanupCase(name, { status = 'PUBLISHED', active = false, overlap = false } = {}) {
  const { client, state } = makeDb({ existing: true, status }); db = client;
  if (active) { state.routes[0].status = 'PREVIOUS'; state.routes.push({ id: 'route-new', videoId: 'video', assetId: 'asset-new', provider: 'SELF_HLS', status: 'ACTIVE' }); state.video.activePlaybackRouteId = 'route-new'; state.assets[0].isPrimary = false; state.assets[1].isPrimary = true; }
  const objects = new Set(['videos/video/v/v1/master.m3u8', 'videos/video/v/v2/master.m3u8']);
  const ctx = load('lib/modules/shared/app-context.ts').createAppContext({ prisma: client, actor: { type: 'admin', userId: 'authorized-staff' }, channelId: 'channel' });
  let beforeDelete = null, deletes = 0;
  const result = await load('lib/modules/video-pipeline/application/output-cleanup.use-cases.ts').deleteSelfHlsAsset(
    { videoId: 'video', assetId: 'asset-new' }, ctx, { hls: { deletePrefix: async prefix => {
      deletes++; state.events.push('cleanup_passed_guard');
      if (overlap) { await new (load('lib/modules/video/application/video-playback-route.service.ts').VideoPlaybackRouteService)().activateRoute({ videoId: 'video', assetId: 'asset-new', activatedBy: 'POLICY' }, ctx); beforeDelete = snapshot(state, objects); }
      for (const key of objects) if (key.startsWith(prefix)) objects.delete(key);
      return 1;
    } } });
  if (active && ['PUBLISHED', 'UNLISTED'].includes(status)) { assert.equal(result.ok, false); assert.equal(result.error.code, 'ASSET_IN_USE'); assert.equal(deletes, 0); }
  else assert.equal(result.ok, true);
  if (overlap) { assert.equal(beforeDelete.active_route_id, 'route-new'); assert.equal(state.video.activePlaybackRouteId, null); assert.equal(snapshot(state, objects).fallback_eligibility, 'NO_PRIMARY_ASSET'); }
  return { name, kind: 'ACTUAL_COMPONENTS_FAKE_IO', result: result.ok ? 'DELETED' : result.error.code,
    storage_delete_calls: deletes, activated_during_delete: beforeDelete, state: snapshot(state, objects), events: state.events };
}
async function main() {
  const observations = [];
  observations.push(await pipelineCase('pipeline_control'));
  observations.push(await pipelineCase('audit_failure_new_asset', { mode: 'audit_failure' }));
  observations.push(await pipelineCase('audit_failure_existing_asset_then_retry', { mode: 'audit_failure', existing: true, retry: true }));
  observations.push(await pipelineCase('post_finalize_status_error_control', { mode: 'status_failure' }));
  observations.push(await pipelineCase('activation_transaction_error_control', { mode: 'transaction_failure' }));
  observations.push(await pipelineCase('lost_claim_actual_finalizer', { mode: 'lost_claim' }));
  observations.push(await cleanupCase('published_active_refused', { active: true }));
  observations.push(await cleanupCase('unlisted_active_refused', { active: true, status: 'UNLISTED' }));
  observations.push(await cleanupCase('draft_active_allowed', { active: true, status: 'DRAFT' }));
  observations.push(await cleanupCase('inactive_cleanup_control'));
  observations.push(await cleanupCase('activation_overlaps_cleanup', { overlap: true }));
  console.log(JSON.stringify({ kind: 'UNCHANGED_TYPESCRIPT_COMPONENTS_WITH_EXPLICIT_FAKE_IO',
    application_baseline_sha: 'c397b9e548ca2c628e21457ac69d66e54b12ddbd', observations,
    actual_source_sha256: Object.fromEntries([...loaded].map(([file, mod]) => [file, mod.sha256])),
    explicit_boundaries: [...boundaries].sort(),
    limits: ['No actual Prisma client, database, HTTP, R2, encoder or publication was executed.',
      'Fake DB models transactions/cascades; their PostgreSQL behavior is checked separately.',
      'Legal staff authorization/channel lookup assumed by explicit boundary; no auth bypass claim.',
      'Runtime enum strings derived from pinned Prisma schema; JsonNull placeholder is local to this harness.',
      'Loss of claim and audit/status failures are deterministic injected I/O events, not observed production incidents.',
      'Playback selection/eligibility helpers executed; complete PlaybackService and viewers were not executed.'],
  }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
