import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
    },
    videoPlaybackSession: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/modules/media', async () => {
  const { MediaPolicy } = await import('@/lib/modules/media/domain/media.policy');
  const { resolvePublicThumbnailSrc } = await import('@/lib/modules/media/domain/r2-thumbnail');
  return { MediaPolicy, resolvePublicThumbnailSrc };
});

const VIDEO_ID = 'v1-0000-aaaa';
const SECRET = 's'.repeat(40);

const baseVideo = {
  id: VIDEO_ID,
  title: 'Secret Video',
  // A legacy raw URL that must never be used or exposed.
  videoUrl: 'https://s3.amazonaws.com/bucket/secret.mp4',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  tier: 'PATRON',
  status: 'PUBLISHED',
  premiereAt: null,
};

const selfHlsAsset = {
  id: 'asset-1',
  videoId: VIDEO_ID,
  provider: 'SELF_HLS',
  objectKey: `videos/${VIDEO_ID}/v/v1`,
  bucket: 'polutek-hls',
  processingState: 'READY',
  isPrimary: true,
  failureReason: null,
  mimeType: 'application/x-mpegURL',
  sizeBytes: 123,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};

const legacyAsset = (provider: string, over: Record<string, unknown> = {}) => ({
  ...selfHlsAsset,
  id: `legacy-${provider}`,
  provider,
  objectKey: 'legacy-object-key',
  isPrimary: false,
  ...over,
});

const LEAK_MARKERS = [
  'playbackUrl',
  'legacy-provider-asset-id',
  'legacy-playback-id',
  'legacy-object-key',
  'legacyYtId',
  'videodelivery.net',
  'stream.mux.com',
  'youtube',
  'vimeo',
  's3.amazonaws.com',
  'secret.mp4',
  '/api/media/',
  `/v/v1`,
  'polutek-hls',
  'video.pawelperfect.com',
];

const assertNothingPlayable = (plan: Awaited<ReturnType<typeof PlaybackService.createPlaybackPlanWithContext>>) => {
  expect(plan.canPlay).toBe(false);
  expect(plan.source).toBeUndefined();
  expect((plan as any).playbackUrl).toBeUndefined();
  expect((plan as any).embedUrl).toBeUndefined();
  expect(plan.tracking.playbackSessionId).toBe('');
  expect(plan.tracking.heartbeatIntervalSeconds).toBe(0);
  expect(plan.player.controls).toBe(false);
  expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  const serialized = JSON.stringify(plan);
  for (const marker of LEAK_MARKERS) expect(serialized).not.toContain(marker);
};

describe('PlaybackService safety (own HLS is the only source)', () => {
  const guestCtx = createAppContext({ actor: { type: 'guest' } });
  const userCtx = createAppContext({ actor: { type: 'user', userId: 'user-1' } });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HLS_TOKEN_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.HLS_TOKEN_SECRET;
  });

  it.each(['PUBLIC', 'LOGGED_IN', 'PATRON'])('a denied guest on a %s video gets no URL, token, id or session even with legacy rows present', async (tier) => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      tier,
      assets: [selfHlsAsset, legacyAsset('CLOUDFLARE_STREAM'), legacyAsset('MUX'), legacyAsset('YOUTUBE'), legacyAsset('VIMEO'), legacyAsset('S3')],
      activePlaybackRoute: { asset: selfHlsAsset },
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'LOGIN_REQUIRED', requiredTier: tier } as any,
    });

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, guestCtx);

    expect(plan.status).toBe('LOGIN_REQUIRED');
    expect(plan.access.allowed).toBe(false);
    expect(plan.diagnostics.providerResolutionAllowed).toBe(false);
    expect(plan.diagnostics.providerResolutionAttempted).toBe(false);
    expect(plan.diagnostics.warnings).toContain('LOGIN_REQUIRED');
    assertNothingPlayable(plan);
  });

  it('answers UNAVAILABLE with nothing playable when the video does not exist', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(null);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'NOT_FOUND' } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, guestCtx);

    expect(plan.status).toBe('UNAVAILABLE');
    expect(plan.access.allowed).toBe(false);
    assertNothingPlayable(plan);
  });

  it('answers ERROR with nothing playable when the access check itself fails', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ ...baseVideo, assets: [selfHlsAsset], activePlaybackRoute: { asset: selfHlsAsset } } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: false, error: new Error('boom') } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, userCtx);

    expect(plan.status).toBe('ERROR');
    assertNothingPlayable(plan);
  });

  it('reports PROCESSING with no source or session while the own-HLS asset is still encoding', async () => {
    const encoding = { ...selfHlsAsset, processingState: 'PROCESSING' };
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ ...baseVideo, assets: [encoding], activePlaybackRoute: null } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, userCtx);

    expect(plan.status).toBe('PROCESSING');
    expect(plan.access.allowed).toBe(true);
    expect(plan.diagnostics.asset?.provider).toBe('SELF_HLS');
    expect(plan.diagnostics.asset).not.toHaveProperty('providerAssetId');
    assertNothingPlayable(plan);
  });

  it('reports UNAVAILABLE without leaking the failure reason when encoding failed', async () => {
    const failed = { ...selfHlsAsset, processingState: 'FAILED', failureReason: 'internal ffmpeg explosion' };
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ ...baseVideo, assets: [failed], activePlaybackRoute: null } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, userCtx);

    expect(plan.status).toBe('UNAVAILABLE');
    expect(plan.diagnostics.warnings).toEqual(['Video asset processing failed']);
    expect(JSON.stringify(plan)).not.toContain('ffmpeg');
    assertNothingPlayable(plan);
  });

  it('never plays a legacy raw videoUrl or a legacy provider asset: NO_PRIMARY_ASSET', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      tier: 'PUBLIC',
      assets: [legacyAsset('CLOUDFLARE_STREAM', { isPrimary: true }), legacyAsset('MUX'), legacyAsset('YOUTUBE'), legacyAsset('VIMEO'), legacyAsset('VERCEL_BLOB'), legacyAsset('R2'), legacyAsset('S3')],
      activePlaybackRoute: { asset: legacyAsset('CLOUDFLARE_STREAM', { isPrimary: true }) },
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, userCtx);

    expect(plan.status).toBe('NO_PRIMARY_ASSET');
    expect(plan.access.allowed).toBe(true);
    assertNothingPlayable(plan);
  });

  it('is NO_PRIMARY_ASSET for a video with no asset at all, whatever the legacy videoUrl says', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ ...baseVideo, tier: 'PUBLIC', assets: [], activePlaybackRoute: null } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, guestCtx);

    expect(plan.status).toBe('NO_PRIMARY_ASSET');
    assertNothingPlayable(plan);
  });

  it('issues a signed own-HLS URL (and a session) for an allowed viewer, redacting identifiers from the contract', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      assets: [selfHlsAsset, legacyAsset('CLOUDFLARE_STREAM', { updatedAt: new Date('2027-01-01') })],
      activePlaybackRoute: { asset: selfHlsAsset },
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true, reason: 'ALLOWED' } as any });
    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's-own-1' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, userCtx);
    const serialized = JSON.stringify(plan);

    expect(plan.status).toBe('READY');
    expect(plan.canPlay).toBe(true);
    expect(plan.source?.provider).toBe('SELF_HLS');
    expect(plan.source?.kind).toBe('self_hls');
    expect(plan.source?.playbackUrl).toMatch(/^https:\/\/video\.pawelperfect\.com\/h\/\d+\.[A-Za-z0-9_-]+\/v1-0000-aaaa\/v1\/master\.m3u8$/);
    expect(plan.source?.isSignedUrl).toBe(true);
    expect(plan.source?.asset).not.toHaveProperty('providerAssetId');
    expect(plan.source?.asset).not.toHaveProperty('providerPlaybackId');
    expect(plan.tracking.playbackSessionId).toBe('s-own-1');
    expect(prisma.videoPlaybackSession.create).toHaveBeenCalledTimes(1);
    expect(serialized).not.toContain('secret.mp4');
    expect(serialized).not.toContain('legacy');
    expect(serialized).not.toContain('"fallback"');
    expect(serialized).not.toContain(SECRET);
  });

  it('fails closed (no URL, no session) when the delivery secret is missing', async () => {
    delete process.env.HLS_TOKEN_SECRET;
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ ...baseVideo, assets: [selfHlsAsset], activePlaybackRoute: { asset: selfHlsAsset } } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, userCtx);

    expect(plan.status).toBe('ERROR');
    expect(plan.access.allowed).toBe(true);
    assertNothingPlayable(plan);
  });

  it('fails closed when the session cannot be created', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({ ...baseVideo, assets: [selfHlsAsset], activePlaybackRoute: { asset: selfHlsAsset } } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });
    vi.mocked(prisma.videoPlaybackSession.create).mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const plan = await PlaybackService.createPlaybackPlanWithContext(VIDEO_ID, userCtx);
    spy.mockRestore();

    expect(plan.status).toBe('ERROR');
    expect(plan.diagnostics.warnings).toContain('Failed to resolve own HLS playback source');
    expect(plan.canPlay).toBe(false);
    expect(plan.source).toBeUndefined();
  });
});
