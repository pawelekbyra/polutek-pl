/* Research: unchanged access/plan/signer/sanitizer and actual Worker module.
 * DB, patron gate (off), R2 and Cache API are explicit local boundaries.
 * Real Node/WebCrypto/Request/Response; simulated clock; no Next/Prisma/Cloudflare/auth server.
 * Tokens, signed URLs and fixture secrets never appear in the JSON result.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = process.cwd();
const base = 'docs/audit/2026-11-01-platform-research/program-audytu';
const inventory = new Map(fs.readFileSync(path.join(root, base, 'INWENTARZ-PLIKOW.csv'), 'utf8')
  .trim().split(/\r?\n/).slice(1).map(row => { const c = row.split(','); return [c[0], c[4]]; }));
const loaded = new Map(), boundaries = new Set();
function checkedBytes(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), inventory.get(file), `Baseline changed: ${file}`);
  return bytes;
}
const schema = checkedBytes('prisma/schema.prisma').toString();
const enums = {};
for (const name of ['VideoStatus', 'StorageProvider', 'VideoAssetProcessingState']) {
  const body = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1];
  enums[name] = Object.fromEntries(body.split('\n').map(s => s.trim()).filter(s => /^[A-Z][A-Z_0-9]*$/.test(s)).map(s => [s, s]));
}
const allowed = new Set([
  'lib/modules/access/application/check-video-access.use-case.ts',
  'lib/modules/playback/application/playback.service.ts',
  'lib/modules/playback/application/self-hls-plan.ts',
  'lib/modules/playback/application/public-playback-plan.ts',
  'lib/modules/playback/infrastructure/self-hls-token.service.ts',
  'lib/modules/playback/domain/primary-playable-asset.ts',
  'lib/modules/authz/domain/principal.ts', 'lib/modules/authz/domain/policy.ts',
  'lib/modules/authz/domain/matrix.ts', 'lib/modules/authz/domain/actions.ts',
  'lib/modules/channel/domain/channel.policy.ts', 'lib/modules/channel/domain/channel.errors.ts',
  'lib/modules/media/domain/protected-caption.ts', 'lib/modules/media/domain/media.policy.ts',
  'lib/modules/media/domain/media-safety.ts', 'lib/modules/media/domain/media.errors.ts',
  'lib/modules/media/domain/r2-thumbnail.ts',
  'lib/modules/video/domain/premiere.ts', 'lib/modules/video/domain/video-visibility.ts',
  'lib/modules/video/domain/video-asset-selection.ts', 'lib/modules/video/domain/video-asset.constants.ts',
  'lib/modules/video/domain/asset-size.ts', 'lib/modules/video/domain/video.dto.ts',
  'lib/modules/shared/app-context.ts', 'lib/modules/shared/app-error.ts', 'lib/modules/shared/result.ts',
  'lib/access-tier.ts', 'lib/feature-flags.ts', 'lib/utils/uuid.ts',
  'lib/video-chapters.ts', 'lib/video-start-time.ts',
]);
let lastAccessResult = null;
const stubs = {
  '@prisma/client': () => enums,
  '@/lib/prisma': () => ({ prisma: undefined }),
  // Transparent observer of the real decision, not a fabricated allow/deny result.
  '@/lib/modules/access': () => ({ checkVideoAccess: async (...args) => {
    const result = await load('lib/modules/access/application/check-video-access.use-case.ts').checkVideoAccess(...args);
    lastAccessResult = result;
    return result;
  } }),
  '@/lib/modules/authz': () => ({ ...load('lib/modules/authz/domain/policy.ts'), ...load('lib/modules/authz/domain/principal.ts') }),
  '@/lib/modules/media': () => ({ ...load('lib/modules/media/domain/protected-caption.ts'), ...load('lib/modules/media/domain/r2-thumbnail.ts'), ...load('lib/modules/media/domain/media.policy.ts') }),
  '@/lib/modules/video': () => ({ ...load('lib/modules/video/domain/video-asset-selection.ts'), ...load('lib/modules/video/domain/video-visibility.ts'), ...load('lib/modules/video/domain/asset-size.ts'), ...load('lib/modules/video/domain/video.dto.ts') }),
  '@/lib/modules/patron-zone': () => ({ premiumPassGate: async () => null, premiumPassOfferFor: async () => null }),
};
function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  assert(allowed.has(file), `Unapproved source import: ${file}`);
  const bytes = checkedBytes(file), mod = { exports: {}, sha256: inventory.get(file) };
  loaded.set(file, mod);
  const js = ts.transpileModule(bytes.toString(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: file,
  }).outputText;
  const localRequire = spec => {
    const resolved = spec.startsWith('@/') ? spec.slice(2) + '.ts'
      : spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)) + '.ts' : spec;
    const stub = stubs[spec] ?? stubs[resolved];
    if (stub) { boundaries.add(spec); return stub(); }
    if (spec.startsWith('node:')) return require(spec);
    return load(resolved);
  };
  new vm.Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(localRequire, mod, mod.exports);
  return mod.exports;
}
const VIDEO = 'c52f0407-b0e8-4b5c-b6d3-a9f152653002';
const OTHER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const T0 = 1_800_000_000_000;
let clock = T0;
const SECRET = crypto.randomBytes(32).toString('hex');
const CAPTION_FILE = `pl-${'ab'.repeat(32)}.vtt`;
const clone = value => structuredClone(value);
function fixture(overrides = {}) {
  return { id: VIDEO, slug: 'fixture-video', creatorId: 'channel', title: 'Private fixture title',
    thumbnailUrl: '/fixture.jpg', tier: 'PUBLIC', status: 'PUBLISHED', moderationStatus: 'VISIBLE', isAdult: false,
    publishedAt: new Date('2020-01-01T00:00:00Z'), premiereAt: null,
    subtitleUrlPl: `hlscap:${CAPTION_FILE}`, subtitleUrlEn: null,
    creator: { id: 'channel', userId: 'owner', status: 'ACTIVE', deletedAt: null, members: [] },
    assets: [{ id: 'asset', provider: 'SELF_HLS', objectKey: `videos/${VIDEO}/v/v1`, processingState: 'READY',
      isPrimary: true, sizeBytes: 10n, createdAt: new Date(T0), updatedAt: new Date(T0) }],
    chapters: null, ...overrides };
}
async function makePlan(options = {}) {
  const actor = options.actor ?? { type: 'guest' };
  const video = options.missing ? null : fixture(options.video);
  const counts = { sessions_created: 0, session_lookups: 0, video_reads: 0 };
  const db = {
    video: {
      findFirst: async ({ where }) => { counts.video_reads++; return video && (where.id === video.id || where.slug === video.slug) ? clone(video) : null; },
      findUnique: async ({ where }) => { counts.video_reads++; return video && where.id === video.id ? clone(video) : null; },
    },
    user: { findUnique: async () => options.deletedUser ? { id: 'viewer', isDeleted: true } : { id: 'viewer', isDeleted: false } },
    entitlement: { findFirst: async () => options.entitled ? { id: 'entitlement' } : null },
    videoPlaybackSession: {
      findUnique: async () => { counts.session_lookups++; return clone(options.existingSession ?? null); },
      create: async () => { counts.sessions_created++; return { id: 'created-session' }; },
    },
  };
  const ctx = load('lib/modules/shared/app-context.ts').createAppContext({ prisma: db, actor, now: () => new Date(clock) });
  const service = load('lib/modules/playback/application/playback.service.ts').PlaybackService;
  lastAccessResult = null;
  const raw = await service.createPlaybackPlanWithContext(VIDEO, ctx, 'fixture-ip-hash', 'fixture-ua-hash', { reuseSessionId: options.reuseSessionId });
  assert(lastAccessResult?.ok);
  const plan = load('lib/modules/playback/application/public-playback-plan.ts').toPublicPlaybackPlan(raw);
  const signed = plan.source?.playbackUrl ? new URL(plan.source.playbackUrl).pathname.split('/')[2] : null;
  const summary = { central_access_allowed: lastAccessResult.data.hasAccess, central_access_reason: lastAccessResult.data.reason ?? null,
    status: plan.status, access_allowed: plan.access.allowed, can_play: plan.canPlay,
    source_present: Boolean(plan.source), title_present: Boolean(plan.player.title), poster_present: Boolean(plan.player.poster),
    premiere_time_present: Boolean(plan.premiereAt), caption_tracks: plan.player.textTracks?.length ?? 0,
    session_present: Boolean(plan.tracking.playbackSessionId), reused_session: plan.tracking.playbackSessionId === options.reuseSessionId,
    token_public_marker: signed ? signed.endsWith('.pub') : null,
    token_remaining_seconds: signed ? Number(signed.split('.')[0]) - Math.floor(clock / 1000) : null, ...counts };
  if (!plan.canPlay) { assert(!plan.source); assert.equal(counts.sessions_created, 0); assert.equal(plan.player.textTracks?.length ?? 0, 0); }
  return { plan, summary, token: signed };
}
class FakeCache {
  constructor() { this.entries = new Map(); this.lookups = 0; this.puts = 0; }
  async match(request) { assert(!request.headers.has('Range'), 'Range semantics are outside this harness'); this.lookups++; return this.entries.get(request.url)?.clone(); }
  async put(request, response) { this.puts++; this.entries.set(request.url, new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers })); }
}
function edgeFixture(worker) {
  const cache = new FakeCache(), objects = new Map([
    [`videos/${VIDEO}/v/v1/master.m3u8`, '#EXTM3U\n'],
    [`videos/${VIDEO}/v/v1/720p/segment.m4s`, 'fixture-media-bytes'],
    [`videos/${VIDEO}/captions/${CAPTION_FILE}`, 'WEBVTT\n\nfixture text\n'],
  ]);
  let gets = 0, heads = 0;
  const env = { HLS_TOKEN_SECRET: SECRET, ALLOWED_ORIGINS: 'https://site.example.invalid', HLS: {
    get: async key => { gets++; const value = objects.get(key); return value === undefined ? null : { body: value, size: value.length, httpEtag: '"fixture"' }; },
    head: async key => { heads++; const value = objects.get(key); return value === undefined ? null : { size: value.length, httpEtag: '"fixture"' }; },
  } };
  async function request(token, { id = VIDEO, version = 'v1', rest = '720p/segment.m4s', method = 'GET', directCachePath = false, origin } = {}) {
    globalThis.caches = { default: cache };
    const pending = [], before = { cache: cache.lookups, gets, heads };
    const uri = directCachePath ? `/c/${id}/${version}/${rest}` : `/h/${token}/${id}/${version}/${rest}`;
    const response = await worker.fetch(new Request('https://media.example.invalid' + uri, { method, headers: origin ? { Origin: origin } : {} }), env, { waitUntil: promise => pending.push(promise) });
    const body = await response.text(); await Promise.all(pending);
    return { status: response.status, cache: response.headers.get('x-hls-cache'), cache_control: response.headers.get('cache-control'),
      content_type: response.headers.get('content-type'), body_present: body.length > 0,
      cors_allowed: response.headers.has('access-control-allow-origin'),
      cache_lookups: cache.lookups - before.cache, r2_gets: gets - before.gets, r2_heads: heads - before.heads };
  }
  return { request, objects, cache };
}
async function main() {
  process.env.HLS_TOKEN_SECRET = SECRET;
  process.env.HLS_DELIVERY_BASE_URL = 'https://media.example.invalid';
  process.env.HLS_TOKEN_TTL_PUBLIC_SECONDS = '21600';
  process.env.HLS_TOKEN_TTL_PROTECTED_SECONDS = '1800';
  process.env.HLS_PUBLIC_TOKEN_MARKER = 'on';
  process.env.ENABLE_DEMO_FALLBACKS = 'false';
  checkedBytes('workers/hls-edge/worker.mjs');
  const worker = (await import(pathToFileURL(path.join(root, 'workers/hls-edge/worker.mjs')).href)).default;
  const observations = [];
  const user = { type: 'user', userId: 'viewer' };
  const future = new Date('2035-01-01T00:00:00Z');
  const cases = [
    ['public_guest', {}, 'READY'],
    ['protected_guest', { video: { tier: 'LOGGED_IN' } }, 'LOGIN_REQUIRED'],
    ['protected_user', { video: { tier: 'LOGGED_IN' }, actor: user }, 'READY'],
    ['deleted_user', { video: { tier: 'LOGGED_IN' }, actor: user, deletedUser: true }, 'ERROR'],
    ['missing_video', { missing: true }, 'UNAVAILABLE'],
    ['archived_video', { video: { status: 'ARCHIVED' } }, 'UNAVAILABLE'],
    ['removed_without_premiere', { video: { moderationStatus: 'REMOVED' } }, 'UNAVAILABLE'],
    ['hidden_channel_without_premiere', { video: { creator: { id: 'channel', userId: 'owner', status: 'SUSPENDED', deletedAt: null, members: [] } } }, 'UNAVAILABLE'],
    ['public_upcoming_guest', { video: { premiereAt: future } }, 'LOGIN_REQUIRED'],
    ['public_upcoming_user', { video: { premiereAt: future }, actor: user }, 'COMING_SOON'],
    ['removed_upcoming_guest_metadata', { video: { moderationStatus: 'REMOVED', premiereAt: future } }, 'LOGIN_REQUIRED'],
    ['hidden_channel_upcoming_guest_metadata', { video: { premiereAt: future, creator: { id: 'channel', userId: 'owner', status: 'SUSPENDED', deletedAt: null, members: [] } } }, 'LOGIN_REQUIRED'],
    ['hidden_channel_upcoming_user_metadata', { video: { premiereAt: future, creator: { id: 'channel', userId: 'owner', status: 'SUSPENDED', deletedAt: null, members: [] } }, actor: user }, 'COMING_SOON'],
    ['paid_without_entitlement', { video: { tier: 'PAID' }, actor: user }, 'ERROR'],
    ['paid_with_entitlement', { video: { tier: 'PAID' }, actor: user, entitled: true }, 'READY'],
  ];
  for (const [name, options, expected] of cases) {
    const result = await makePlan(options); assert.equal(result.summary.status, expected, name);
    if (['missing_video', 'archived_video', 'removed_without_premiere', 'hidden_channel_without_premiere'].includes(name)) assert(!result.summary.title_present && !result.summary.poster_present);
    if (name.endsWith('_metadata')) {
      assert.equal(result.summary.central_access_reason, 'NOT_FOUND'); assert.equal(result.summary.central_access_allowed, false);
      assert.equal(result.plan.player.title, 'Private fixture title'); assert.equal(result.plan.player.poster, `/api/videos/${VIDEO}/thumbnail`);
      if (name === 'hidden_channel_upcoming_user_metadata') assert.equal(result.plan.premiereAt, future.toISOString());
      assert(!result.summary.source_present && !result.summary.session_present);
    }
    if (name === 'protected_user') { assert.equal(result.summary.token_remaining_seconds, 1800); assert.equal(result.summary.token_public_marker, false); assert.equal(result.summary.caption_tracks, 1); }
    if (name === 'public_guest') { assert.equal(result.summary.token_remaining_seconds, 21600); assert.equal(result.summary.token_public_marker, true); }
    observations.push({ kind: 'ACTUAL_ACCESS_PLAN_SANITIZER_FAKE_DB', name, ...result.summary });
  }
  const session = { id: 'existing-session', videoId: VIDEO, userId: 'viewer', ipHash: 'fixture-ip-hash', userAgentHash: 'fixture-ua-hash', isAdminPreview: false, createdAt: new Date(T0 - 60_000) };
  for (const [name, actor, existing, reuse] of [
    ['own_user_session_reused', user, session, true],
    ['foreign_user_session_replaced', user, { ...session, userId: 'other-viewer' }, false],
    ['wrong_video_session_replaced', user, { ...session, videoId: OTHER }, false],
    ['own_guest_fingerprint_reused', { type: 'guest' }, { ...session, userId: null }, true],
    ['foreign_guest_fingerprint_replaced', { type: 'guest' }, { ...session, userId: null, ipHash: 'other-ip' }, false],
  ]) {
    const result = await makePlan({ actor, reuseSessionId: session.id, existingSession: existing });
    assert.equal(result.summary.reused_session, reuse); assert.equal(result.summary.sessions_created, reuse ? 0 : 1);
    observations.push({ kind: 'ACTUAL_SESSION_REUSE_FAKE_DB', name, ...result.summary });
  }
  const signer = load('lib/modules/playback/infrastructure/self-hls-token.service.ts').SelfHlsTokenService;
  const sign = (options = {}) => signer.sign({ videoId: VIDEO, version: 'v1', secret: SECRET, nowMs: T0, ttlSeconds: 1800, ...options }).token;
  const edge = edgeFixture(worker), protectedToken = sign();
  for (const [name, token, options, expected] of [
    ['protected_cache_miss', protectedToken, {}, 200],
    ['protected_cache_hit', protectedToken, {}, 200],
    ['forged_public_marker_rejected_before_cache', protectedToken + '.pub', {}, 403],
    ['wrong_video_rejected_before_cache', protectedToken, { id: OTHER }, 403],
    ['wrong_version_rejected_before_cache', protectedToken, { version: 'v2' }, 403],
    ['forged_signature_rejected_before_cache', `${Math.floor(T0 / 1000) + 1800}.${'A'.repeat(43)}`, {}, 403],
    ['direct_cache_path_not_served', protectedToken, { directCachePath: true }, 404],
    ['caption_with_video_token', protectedToken, { rest: `captions/${CAPTION_FILE}` }, 200],
    ['malformed_caption_path_refused', protectedToken, { rest: 'captions/pl-not-a-hash.vtt' }, 404],
    ['public_token_shared_cache_headers', sign({ isPublic: true }), {}, 200],
    ['protected_after_public_cache_still_private', protectedToken, {}, 200],
    ['foreign_origin_has_no_cors_grant', protectedToken, { origin: 'https://other.example.invalid' }, 200],
    ['allowed_origin_has_cors_grant', protectedToken, { origin: 'https://site.example.invalid' }, 200],
  ]) {
    const result = await edge.request(token, options); assert.equal(result.status, expected, name);
    if (expected !== 200) assert.equal(result.cache_lookups, 0, name);
    if (name === 'protected_after_public_cache_still_private') assert.equal(result.cache_control, 'private, max-age=1800');
    if (name === 'foreign_origin_has_no_cors_grant') assert.equal(result.cors_allowed, false);
    if (name === 'allowed_origin_has_cors_grant') assert.equal(result.cors_allowed, true);
    observations.push({ kind: 'ACTUAL_WORKER_FAKE_CACHE_R2', name, ...result });
  }
  for (const [name, before, after] of [
    ['logout_actor_snapshot', { actor: user, video: { tier: 'LOGGED_IN' } }, { video: { tier: 'LOGGED_IN' } }],
    ['channel_suspension_snapshot', { actor: user, video: { tier: 'LOGGED_IN' } }, { actor: user, video: { tier: 'LOGGED_IN', creator: { id: 'channel', userId: 'owner', status: 'SUSPENDED', deletedAt: null, members: [] } } }],
    ['unpublish_snapshot', { actor: user, video: { tier: 'LOGGED_IN' } }, { actor: user, video: { tier: 'LOGGED_IN', status: 'DRAFT' } }],
    ['public_video_removed_snapshot', {}, { video: { moderationStatus: 'REMOVED' } }],
  ]) {
    clock = T0;
    const issued = await makePlan(before), delivery = edgeFixture(worker);
    const warm = await delivery.request(issued.token); assert.equal(warm.status, 200);
    const fresh = await makePlan(after); assert.equal(fresh.summary.access_allowed, false); assert.equal(fresh.summary.source_present, false);
    clock = T0 + 1000;
    const replay = await delivery.request(issued.token); assert.equal(replay.status, 200); assert.equal(replay.cache, 'HIT');
    clock = Number(issued.token.split('.')[0]) * 1000 + 1000;
    const expired = await delivery.request(issued.token); assert.equal(expired.status, 403); assert.equal(expired.cache_lookups, 0);
    observations.push({ kind: 'R07_CURRENT_PLAN_DENIAL_AND_OLD_TOKEN_REPLAY', name,
      issued_ttl_seconds: issued.summary.token_remaining_seconds, new_plan: fresh.summary, replay_before_expiry: replay, replay_after_expiry: expired });
  }
  clock = T0;
  const cachedDeleted = edgeFixture(worker);
  await cachedDeleted.request(protectedToken);
  cachedDeleted.objects.clear();
  const afterOriginDelete = await cachedDeleted.request(protectedToken);
  assert.equal(afterOriginDelete.status, 200); assert.equal(afterOriginDelete.cache, 'HIT'); assert.equal(afterOriginDelete.r2_gets, 0);
  observations.push({ kind: 'ACTUAL_WORKER_FAKE_CACHE_R2', name: 'cached_bytes_after_origin_removal', ...afterOriginDelete });
  console.log(JSON.stringify({ application_baseline_sha: 'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
    runtime: { node: process.version, typescript: ts.version }, observations,
    actual_typescript_source_sha256: Object.fromEntries([...loaded].map(([file, mod]) => [file, mod.sha256])),
    worker_sha256: inventory.get('workers/hls-edge/worker.mjs'), explicit_boundaries: [...boundaries].sort(),
    tokens_and_signed_urls_redacted: true, simulated_clock: true,
    limits: ['No generated Prisma client, actual DB, Next HTTP, auth session/logout operation, Cloudflare runtime, R2 or browser playback.',
      'Patron gate explicitly off; paid-entitlement rows are synthetic. No billing or active production configuration assertion.',
      'Runtime enum strings derived from pinned schema, no client installed or replaced.',
      'Cache fake only supports tested full-body GET behavior, no real browser/CDN TTL eviction or Range semantics.',
      'Logout/suspension/unpublish/removal states are supplied snapshots; actual mutation endpoints were not executed.',
      'Clock advances are simulated; no wall-clock TTL measurement. No fixture tokens or secrets emitted.'],
  }, null, 2));
}
const OriginalDate = Date;
class ResearchDate extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
}
globalThis.Date = ResearchDate;
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { globalThis.Date = OriginalDate; });
