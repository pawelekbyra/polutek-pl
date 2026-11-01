/* Research harness, not an application test suite. Run with Node from the repository root.
 * Executes unchanged TypeScript modules through transpileModule, with explicit fake I/O.
 * No generated Prisma client, real database, HTTP server, cookies, storage or encoding.
 * Missing imports fail closed. This does not turn blocked Vitest tests into passes.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = process.cwd();
// These approved module paths contain no CSV quoting/commas; use the archived baseline inventory.
const baselineHashes = new Map(fs.readFileSync(path.join(root,
  'docs/audit/2026-11-01-platform-research/program-audytu/INWENTARZ-PLIKOW.csv'), 'utf8')
  .trim().split(/\r?\n/).slice(1).map(row => { const columns = row.split(','); return [columns[0], columns[4]]; }));
const loaded = new Map();
const boundaries = new Set();
const actual = new Set([
  'lib/api/auth.ts', 'lib/api/studio-session.ts',
  'lib/modules/shared/app-context.ts', 'lib/modules/shared/app-error.ts',
  'lib/modules/authz/application/authorize.ts', 'lib/modules/authz/domain/actions.ts',
  'lib/modules/authz/domain/principal.ts', 'lib/modules/authz/domain/policy.ts',
  'lib/modules/authz/domain/matrix.ts',
  'lib/modules/channel/application/main-channel.service.ts',
  'lib/modules/channel/infrastructure/channel.repository.ts',
  'lib/modules/channel/domain/main-channel-setting.ts',
  'lib/modules/channel/domain/channel.policy.ts', 'lib/modules/channel/domain/channel.errors.ts',
  'lib/modules/video-pipeline/application/finalize-self-hls.ts',
  'lib/modules/video/application/publish-after-asset-ready.use-case.ts',
  'lib/modules/video/application/ready-visibility.ts',
  'lib/modules/video/infrastructure/video.repository.ts',
  'lib/modules/video/domain/video.policy.ts', 'lib/modules/video/domain/video.errors.ts',
  'lib/modules/video/domain/video-asset-selection.ts', 'lib/modules/video/domain/video-asset.constants.ts',
]);
let db, sessionUserId = 'user-a', sessionOptions, ownChannels = [];
let publicationCalls = [], observations = [];
const fakeLogger = { warn() {}, error() {}, info() {}, debug() {} };
const publisher = visibility => async (videoId, ctx) => {
  publicationCalls.push({ videoId, visibility, channelId: ctx.channelId ?? null });
  return { ok: true, data: {} };
};
const stubs = {
  '@/lib/prisma': () => ({ prisma: db }),
  '@/lib/auth/server': () => ({ auth: async options => { sessionOptions = options; return { userId: sessionUserId }; } }),
  '@/lib/errors': () => ({ AppError: load('lib/modules/shared/app-error.ts').AppError }),
  '@/lib/logger': () => ({ logger: fakeLogger, createScopedLogger: () => fakeLogger }),
  '@/lib/modules/audit': () => ({ recordAuditEvent: async () => {} }),
  '@/lib/modules/channel': () => ({
    ...load('lib/modules/channel/application/main-channel.service.ts'),
    ...load('lib/modules/channel/domain/channel.policy.ts'),
    listMyChannels: async () => ownChannels,
  }),
  '@/lib/modules/video': () => ({
    ...load('lib/modules/video/application/publish-after-asset-ready.use-case.ts'),
    VideoPlaybackRouteService: class { async activateRoute() {} },
    syncPublicThumbnailById: async () => {},
  }),
  '@/lib/modules/media': () => ({ R2ThumbnailStorageClient: class { static isConfigured() { return false; } } }),
  // Unused runtime imports of the real repository/policy. No fake enum implementation is installed.
  '@prisma/client': () => ({}),
  '@/lib/access-tier': () => ({}),
  'lib/modules/video/domain/fundraising.ts': () => ({}),
  'lib/modules/video/application/publish-admin-video.use-case.ts': () => ({ publishAdminVideo: publisher('PUBLISHED') }),
  'lib/modules/video/application/unlist-admin-video.use-case.ts': () => ({ unlistAdminVideo: publisher('UNLISTED') }),
};

function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  assert(actual.has(file), `Unapproved source module: ${file}`);
  const bytes = fs.readFileSync(path.join(root, file));
  const source = ts.transpileModule(bytes.toString(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const mod = { exports: {}, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  assert.equal(mod.sha256, baselineHashes.get(file), `Source changed since the archived baseline: ${file}`);
  loaded.set(file, mod);
  const localRequire = spec => {
    let resolved = spec.startsWith('@/') ? `${spec.slice(2)}.ts`
      : spec.startsWith('.') ? `${path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))}.ts` : spec;
    const stub = stubs[spec] ?? stubs[resolved];
    if (stub) { boundaries.add(spec); return stub(); }
    if (spec === 'react' || spec.startsWith('node:')) return require(spec);
    return load(resolved);
  };
  new vm.Script(`(function(require,module,exports){${source}\n})`, { filename: file })
    .runInThisContext()(localRequire, mod, mod.exports);
  return mod.exports;
}

async function main() {
  let user = { id: 'user-a', role: 'USER', isDeleted: false, onboardingPending: false };
  db = { user: { findUnique: async () => user } };
  const api = load('lib/api/auth.ts');
  assert.equal((await api.getActorFromAuth()).type, 'user');
  observations.push({ scenario: 'Identity remains user after DB role demotion', actor: await api.getActorFromAuth() });
  user = { ...user, isDeleted: true };
  await assert.rejects(api.getActorFromAuth(), error => error.statusCode === 403);
  observations.push({ scenario: 'Deleted account is denied', statusCode: 403 });
  user = { ...user, role: 'ADMIN', isDeleted: false };
  await api.requireAdminActor();
  assert.deepEqual(sessionOptions, { fresh: true });
  observations.push({ scenario: 'Admin actor explicitly bypasses cookie cache', sessionOptions });
  const studio = load('lib/api/studio-session.ts');
  ownChannels = [{ id: 'channel-a', userId: 'user-a' }];
  const s = await studio.resolveStudioSession({ channelId: 'foreign-channel' });
  assert.equal(s.ctx.actor.type, 'user');
  assert.equal(s.ctx.channelId, 'channel-a');
  observations.push({ scenario: 'Studio ADMIN downgrades; foreign selection falls back to first own channel',
    requested: 'foreign-channel', selected: s.ctx.channelId, actor: s.ctx.actor });

  const { authorize } = load('lib/modules/authz/application/authorize.ts');
  const channels = { a: { id: 'a', userId: 'owner-a', status: 'ACTIVE', members: [] },
    b: { id: 'b', userId: 'owner-b', status: 'ACTIVE', members: [] } };
  const authDb = { creator: { findUnique: async ({ where }) => channels[where.id] ?? null },
    video: { findUnique: async ({ where }) => where.id === 'video-b' ? { creator: channels.b } : null },
    channelMember: { findMany: async ({ where }) => where.channelId === 'a' && where.userId === 'editor-a'
      ? [{ userId: 'editor-a', role: 'EDITOR' }] : [] } };
  const cases = [
    ['own channel', { type: 'user', userId: 'owner-a' }, 'video.update', { channelId: 'a' }, null],
    ['foreign channel', { type: 'user', userId: 'owner-a' }, 'video.update', { channelId: 'b' }, 403],
    ['foreign video', { type: 'user', userId: 'owner-a' }, 'video.upload', { videoId: 'video-b' }, 403],
    ['absent video', { type: 'user', userId: 'owner-a' }, 'video.upload', { videoId: 'missing' }, 404],
    ['guest', { type: 'guest' }, 'video.update', { channelId: 'a' }, 401],
    ['onboarding pending', { type: 'user', userId: 'owner-a', onboardingPending: true }, 'video.update', { channelId: 'a' }, 403],
    ['editor own with membership lookup', { type: 'user', userId: 'editor-a' }, 'video.update', { channel: { id: 'a', ownerUserId: 'owner-a', status: 'ACTIVE' } }, null],
    ['editor cannot delete', { type: 'user', userId: 'editor-a' }, 'video.delete', { channel: { id: 'a', ownerUserId: 'owner-a', status: 'ACTIVE' } }, 403],
    ['staff cannot change payout', { type: 'admin', userId: 'staff' }, 'payout.manage', null, 403],
    ['ordinary user cannot staff-action', { type: 'user', userId: 'owner-a' }, 'platform.settings', null, 403],
    ['frozen owner', { type: 'user', userId: 'owner-a' }, 'video.update', { channel: { id: 'a', ownerUserId: 'owner-a', status: 'SUSPENDED' } }, 403],
  ];
  for (const [name, actor, action, target, expectedStatus] of cases) {
    const error = await authorize({ prisma: authDb, actor }, action, target);
    const status = error?.statusCode ?? null;
    assert.equal(status, expectedStatus, name);
    observations.push({ scenario: name, action, expectedStatus, observedStatus: status });
  }

  // Connect the actual worker finalizer -> auto-publish -> channel service -> repository.
  // Publishers and route activation are observation boundaries, not simulated proof of real publication.
  const allChannels = { main: { id: 'main', slug: 'main', userId: 'owner-main', status: 'ACTIVE' },
    creator: { id: 'creator', slug: 'creator', userId: 'owner-other', status: 'ACTIVE' } };
  const videos = Object.fromEntries(Object.keys(allChannels).map(id => [`video-${id}`, {
    id: `video-${id}`, creatorId: id, title: 'Valid', slug: `valid-${id}`, tier: 'PUBLIC', status: 'DRAFT',
    publishAfterAssetReady: true, publishAfterAssetReadyCompletedAt: null,
    publishAfterAssetReadyVisibility: 'PUBLISHED', publishAfterAssetReadyError: null,
    thumbnailUrl: 'already-set', duration: '1:00', assets: [],
    activePlaybackRoute: { asset: { provider: 'SELF_HLS', processingState: 'READY', objectKey: 'fixture/key' } },
  }]));
  const lookupLog = [];
  const workerDb = {
    appSetting: { findUnique: async () => ({ value: 'main' }) },
    creator: { findUnique: async ({ where }) => allChannels[where.id] ?? null },
    video: {
      findUnique: async ({ where }) => videos[where.id] ?? null,
      findFirst: async ({ where }) => {
        lookupLog.push(where);
        const row = videos[where.id];
        return row?.creatorId === where.creatorId ? row : null;
      },
    },
    videoAsset: { findFirst: async () => ({ id: 'fixture-asset' }) },
  };
  const { createSelfHlsFinalizer } = load('lib/modules/video-pipeline/application/finalize-self-hls.ts');
  const { attemptPublishAfterAssetReady } = load('lib/modules/video/application/publish-after-asset-ready.use-case.ts');
  const finalizer = createSelfHlsFinalizer(workerDb);
  for (const id of ['main', 'creator']) {
    const start = publicationCalls.length;
    const result = await finalizer.finalize({ job: { id: `job-${id}`, videoId: `video-${id}`, channelId: id },
      assetKey: 'fixture/key', totalBytes: 1, meta: { source: {} } });
    const observed = { scenario: `actual worker finalizer: ${id}`, jobChannelId: id, result,
      lookup: lookupLog.at(-1), publicationBoundaryCalls: publicationCalls.slice(start),
      storedAutoPublishError: videos[`video-${id}`].publishAfterAssetReadyError };
    assert.equal(publicationCalls.length - start, id === 'main' ? 1 : 0);
    observations.push(observed);
  }
  const start = publicationCalls.length;
  await attemptPublishAfterAssetReady('video-creator', { prisma: workerDb, actor: { type: 'system', reason: 'control' }, channelId: 'creator' });
  assert.equal(publicationCalls.length - start, 1);
  observations.push({ scenario: 'positive control: explicit non-main channel context', lookup: lookupLog.at(-1),
    publicationBoundaryCalls: publicationCalls.slice(start) });
  console.log(JSON.stringify({ kind: 'isolated_actual_source_with_fake_io',
    application_baseline_sha: 'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
    limits: 'No HTTP, real sessions, Prisma client, DB, route activation, encoding, storage, or actual publisher execution. Demotion case starts with a DB USER, not a real stale cookie.',
    actual_source_sha256: Object.fromEntries([...loaded].map(([file, mod]) => [file, mod.sha256])),
    stub_import_boundaries: [...boundaries].sort(), observations }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
