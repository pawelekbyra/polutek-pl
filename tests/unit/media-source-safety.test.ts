import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackService } from '@/lib/modules/playback';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { prisma } from '@/lib/prisma';
import { StorageService } from '@/lib/modules/media';

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

vi.mock('@/lib/blob', () => ({
    isAllowedVideoSourceUrl: vi.fn().mockReturnValue(true)
}));

vi.mock('@/lib/modules/media', async () => {
  const { MediaPolicy } = await import('@/lib/modules/media/domain/media.policy');
  return {
    MediaPolicy,
    StorageService: {
      getPresignedUrl: vi.fn(),
    },
  };
});

const { mockCreateSignedPlaybackToken, mockGetAssetDetails } = vi.hoisted(() => ({
  mockCreateSignedPlaybackToken: vi.fn(),
  mockGetAssetDetails: vi.fn(),
}));
vi.mock('@/lib/modules/playback/infrastructure/cloudflare-signed-playback-token.service', () => ({
  CloudflareSignedPlaybackTokenService: {
    isConfigured: vi.fn(() => true),
    createSignedPlaybackToken: mockCreateSignedPlaybackToken,
  },
}));

const baseVideo = {
  id: 'v1',
  title: 'Secret Video',
  videoUrl: 'https://s3.amazonaws.com/bucket/secret.mp4',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  tier: 'PATRON',
};

const cloudflareAsset = {
  id: 'asset-1',
  videoId: 'v1',
  provider: 'CLOUDFLARE_STREAM',
  objectKey: 'cloudflare/cf-provider-object-key',
  bucket: null,
  providerAssetId: 'cf-asset-id',
  providerPlaybackId: 'cf-playback-id',
  processingState: 'READY',
  isPrimary: true,
  failureReason: null,
  mimeType: 'video/mp4',
  sizeBytes: 123,
};

describe('PlaybackService Safety', () => {
  const ctx = createAppContext({
    actor: { type: 'guest' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not return source, session, or provider data if access is denied (PATRON_REQUIRED)', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' } as any,
    });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('PATRON_REQUIRED');
    expect(plan.access.allowed).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.providerResolutionAllowed).toBe(false);
    expect(plan.diagnostics.providerResolutionAttempted).toBe(false);
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
    expect(plan.diagnostics.warnings).toContain('PATRON_REQUIRED');
  });

  it('should not return source, session, or provider data for logged-in non-patron denied on patron-only video', async () => {
    const userCtx = createAppContext({
      actor: { type: 'user', userId: 'u1' },
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' } as any,
    });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', userCtx);

    expect(plan.status).toBe('PATRON_REQUIRED');
    expect(plan.access.allowed).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('should not return source, session, or provider data if access is denied (LOGIN_REQUIRED)', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'LOGIN_REQUIRED' } as any,
    });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('LOGIN_REQUIRED');
    expect(plan.access.allowed).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.providerResolutionAllowed).toBe(false);
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('should not return source, session, or provider data if video is not found', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue(null);

    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'NOT_FOUND' } as any,
    });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('UNAVAILABLE');
    expect(plan.access.allowed).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.providerResolutionAllowed).toBe(false);
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('returns processing plan with no source, session, or provider call for allowed Cloudflare asset still processing', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: { ...cloudflareAsset, processingState: 'PROCESSING' },
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('PROCESSING');
    expect(plan.access.allowed).toBe(true);
    expect(plan.canPlay).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.sourceMode).toBe('PROVIDER_ASSET');
    expect(plan.diagnostics.asset?.provider).toBe('CLOUDFLARE_STREAM');
    expect(plan.diagnostics.providerResolutionAllowed).toBe(false);
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('returns unavailable plan with no source, session, or provider call for allowed Cloudflare asset that failed', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: { ...cloudflareAsset, processingState: 'FAILED', failureReason: 'provider failed internally' },
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('UNAVAILABLE');
    expect(plan.access.allowed).toBe(true);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.warnings).toEqual(['Video asset processing failed']);
    expect(plan.diagnostics.asset?.providerAssetId).toBeNull();
    expect(plan.diagnostics.asset?.providerPlaybackId).toBeNull();
    expect(JSON.stringify(plan)).not.toContain('cf-asset-id');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
    expect(plan.source).toBeUndefined();
    expect(JSON.stringify(plan)).not.toContain('secret.mp4');
  });

  it('returns no-primary-asset plan with no source, session, or provider call when current asset is not primary', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: { ...cloudflareAsset, isPrimary: false },
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('NO_PRIMARY_ASSET');
    expect(plan.access.allowed).toBe(true);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.providerResolutionAllowed).toBe(false);
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
    expect(plan.source).toBeUndefined();
    expect(JSON.stringify(plan)).not.toContain('secret.mp4');
  });


  it('returns no-primary-asset plan with no provider call when allowed video has no asset and no legacy URL', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      videoUrl: '',
      asset: null,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('NO_PRIMARY_ASSET');
    expect(plan.access.allowed).toBe(true);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.sourceMode).toBe('LEGACY_URL');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('blocks patron-only legacy videoUrl fallback when no READY provider-backed asset exists', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/private.mp4',
      asset: null,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('NO_PRIMARY_ASSET');
    expect(plan.access.allowed).toBe(true);
    expect(plan.canPlay).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.player.controls).toBe(false);
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.sourceMode).toBe('LEGACY_URL');
    expect(plan.diagnostics.warnings).toContain('Patron-only legacy playback fallback is disabled until a READY provider-backed asset is available');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('blocks patron-only READY legacy storage asset fallback without signing storage URLs', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: {
        ...cloudflareAsset,
        provider: 'S3',
        providerAssetId: null,
        providerPlaybackId: null,
        objectKey: 'private/video.mp4',
        bucket: 'private-bucket',
        processingState: 'READY',
      },
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('NO_PRIMARY_ASSET');
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.sourceMode).toBe('PROVIDER_ASSET');
    expect(plan.diagnostics.asset?.provider).toBe('S3');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });


  it('keeps patron legacy fallback blocked regardless of env flags', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/private.mp4',
      asset: null,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('NO_PRIMARY_ASSET');
    expect(plan.canPlay).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });


  it('should redact raw videoUrl while preserving legacy URL playback behavior when access is allowed', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      id: 'v1',
      title: 'Public Video',
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      tier: 'PUBLIC',
      asset: null,
    } as any);

    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's1' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.access.allowed).toBe(true);
    expect(plan.canPlay).toBe(true);
    expect(plan.source).toBeDefined();
    expect(plan.source?.playbackUrl).toBe('/api/media/v1');
    expect(plan.source?.playbackUrl).not.toContain('s3.amazonaws.com');
    expect(plan.tracking.playbackSessionId).toBe('s1');
  });

  it('should allow YouTube URLs without redaction if they are safe', async () => {
     vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      id: 'v1',
      title: 'YouTube Video',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      tier: 'PUBLIC',
      asset: null,
    } as any);

    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's1' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.access.allowed).toBe(true);
    expect(plan.source?.kind).toBe('youtube');
    expect(plan.source?.playbackUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('resolves Cloudflare signed playback and creates a session for allowed patron with READY asset', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    const mockToken = 'cf-signed-token';
    const mockSession = { id: 's-cf-1' };

    mockCreateSignedPlaybackToken.mockReturnValue({ token: mockToken, expiresAt: new Date('2026-06-26T01:00:00.000Z'), expiresInSeconds: 3600 });

    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue(mockSession as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.access.allowed).toBe(true);
    expect(plan.canPlay).toBe(true);
    expect(plan.source?.provider).toBe('CLOUDFLARE_STREAM');
    expect(plan.source?.kind).toBe('cloudflare_stream');
    expect(plan.source?.playbackUrl).toBe(`https://videodelivery.net/${mockToken}/manifest/video.m3u8`);
    expect(plan.source?.playbackUrl).not.toBe(`/api/media/v1`);
    expect(plan.source?.playbackUrl).not.toContain('s3.amazonaws.com');
    expect(plan.source?.needsProxy).toBe(false);
    expect(plan.source?.embedUrl).toBe(`https://iframe.videodelivery.net/${mockToken}`);
    expect(plan.source?.isSignedUrl).toBe(true);
    expect(plan.source?.expiresAt).toBe('2026-06-26T01:00:00.000Z');
    expect(plan.diagnostics.sourceMode).toBe('PROVIDER_ASSET');
    expect(plan.tracking.playbackSessionId).toBe('s-cf-1');

    expect(mockCreateSignedPlaybackToken).toHaveBeenCalledWith({ videoUid: 'cf-playback-id' });
    expect(prisma.videoPlaybackSession.create).toHaveBeenCalled();
  });


  it('keeps READY Cloudflare provider asset preferred over legacy videoUrl and raw object storage', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/legacy-should-not-win.mp4',
      asset: cloudflareAsset,
    } as any);

    mockCreateSignedPlaybackToken.mockReturnValue({ token: 'cf-provider-wins', expiresAt: new Date('2026-06-26T01:00:00.000Z'), expiresInSeconds: 3600 });
    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's-cf-wins' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.source?.provider).toBe('CLOUDFLARE_STREAM');
    expect(plan.source?.kind).toBe('cloudflare_stream');
    expect(plan.source?.playbackUrl).toBe('https://videodelivery.net/cf-provider-wins/manifest/video.m3u8');
    expect(plan.source?.playbackUrl).not.toBe('/api/media/v1');
    expect(JSON.stringify(plan.source)).not.toContain('legacy-should-not-win.mp4');
  });


  it.each([
    'https://videodelivery.net/cf-playback-id/manifest/video.m3u8',
    'https://customer-xxx.cloudflarestream.com/cf-playback-id/manifest/video.m3u8',
  ])('uses signed Cloudflare HLS manifest as playbackUrl while preserving iframe embed fallback and ignoring asset HLS data: %s', async (hlsManifestUrl) => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    mockGetAssetDetails.mockResolvedValue({
      result: { playback: { hls: hlsManifestUrl } },
    });
    mockCreateSignedPlaybackToken.mockReturnValue({ token: 'cf-signed-token', expiresAt: new Date('2026-06-26T01:00:00.000Z'), expiresInSeconds: 3600 });
    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's-cf-hls' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.canPlay).toBe(true);
    expect(plan.source?.kind).toBe('cloudflare_stream');
    expect(plan.source?.playbackUrl).toBe('https://videodelivery.net/cf-signed-token/manifest/video.m3u8');
    expect(plan.source?.embedUrl).toBe('https://iframe.videodelivery.net/cf-signed-token');
    expect(mockGetAssetDetails).not.toHaveBeenCalled();
  });

  it('keeps Cloudflare iframe fallback when explicit HLS manifest is absent', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    mockCreateSignedPlaybackToken.mockReturnValue({ token: 'cf-fallback-token', expiresAt: new Date('2026-06-26T01:00:00.000Z'), expiresInSeconds: 3600 });
    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's-cf-fallback' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.source?.playbackUrl).toBe('https://videodelivery.net/cf-fallback-token/manifest/video.m3u8');
    expect(plan.source?.embedUrl).toBe('https://iframe.videodelivery.net/cf-fallback-token');
  });

  it.each([
    'https://evil.example/cf-playback-id/manifest/video.m3u8',
    'http://videodelivery.net/cf-playback-id/manifest/video.m3u8',
    'https://videodelivery.net/cf-playback-id/manifest/video.mp4',
    'not-a-url',
  ])('ignores unsafe or invalid Cloudflare HLS data and keeps signed iframe playback working: %s', async (hlsManifestUrl) => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    mockGetAssetDetails.mockResolvedValue({
      result: { playback: { hls: hlsManifestUrl } },
    });
    mockCreateSignedPlaybackToken.mockReturnValue({ token: 'cf-safe-token', expiresAt: new Date('2026-06-26T01:00:00.000Z'), expiresInSeconds: 3600 });
    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 's-cf-safe' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.canPlay).toBe(true);
    expect(plan.source?.playbackUrl).toBe('https://videodelivery.net/cf-safe-token/manifest/video.m3u8');
    expect(plan.source?.embedUrl).toBe('https://iframe.videodelivery.net/cf-safe-token');
  });

  it('fails closed when Cloudflare resolution fails for allowed patron', async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: true } as any,
    });

    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);

    mockCreateSignedPlaybackToken.mockImplementation(() => { throw new Error('signing unavailable'); });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('ERROR');
    expect(plan.canPlay).toBe(false);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.warnings).toContain('Failed to resolve secure playback source');
    expect(plan.diagnostics.providerResolutionAttempted).toBe(true);
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });
});

const assertDeniedPlanHasNoPrivatePlaybackLeak = (plan: Awaited<ReturnType<typeof PlaybackService.createPlaybackPlanWithContext>>, forbidden: string[]) => {
  const serialized = JSON.stringify(plan);

  expect(plan.canPlay).toBe(false);
  expect(plan.access.allowed).toBe(false);
  expect(plan.source).toBeUndefined();
  expect((plan as any).playbackUrl).toBeUndefined();
  expect((plan as any).embedUrl).toBeUndefined();
  expect(plan.tracking.playbackSessionId).toBe('');
  expect(plan.tracking.heartbeatIntervalSeconds).toBe(0);
  expect(plan.player.controls).toBe(false);
  expect(plan.diagnostics.providerResolutionAllowed).toBe(false);
  expect(plan.diagnostics.providerResolutionAttempted).toBe(false);
  expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
  expect(mockCreateSignedPlaybackToken).not.toHaveBeenCalled();
  expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();

  for (const secret of forbidden) {
    expect(serialized).not.toContain(secret);
  }
};

describe('PlaybackService private playback leakage regression coverage', () => {
  const guestCtx = createAppContext({ actor: { type: 'guest' } });
  const loggedInCtx = createAppContext({ actor: { type: 'user', userId: 'non-patron-user' } });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'guest denied on LOGGED_IN Cloudflare video',
      ctx: guestCtx,
      tier: 'LOGGED_IN',
      decision: { hasAccess: false, reason: 'LOGIN_REQUIRED', requiredTier: 'LOGGED_IN' },
      expectedStatus: 'LOGIN_REQUIRED',
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/logged-in-legacy-secret.mp4?token=legacy-login',
    },
    {
      name: 'guest denied on PATRON Cloudflare video',
      ctx: guestCtx,
      tier: 'PATRON',
      decision: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' },
      expectedStatus: 'PATRON_REQUIRED',
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/patron-legacy-secret.mp4?token=legacy-guest',
    },
    {
      name: 'logged-in non-patron denied on PATRON Cloudflare video',
      ctx: loggedInCtx,
      tier: 'PATRON',
      decision: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' },
      expectedStatus: 'PATRON_REQUIRED',
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/patron-user-legacy-secret.mp4?token=legacy-user',
    },
  ])('$name never receives private playback fields, tokens, provider IDs, or fallback sources', async ({ ctx, tier, decision, expectedStatus, videoUrl }) => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      tier,
      videoUrl,
      assets: [cloudflareAsset],
      asset: undefined,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: decision as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe(expectedStatus);
    assertDeniedPlanHasNoPrivatePlaybackLeak(plan, [
      'playbackUrl',
      'embedUrl',
      'cf-playback-id',
      'cf-asset-id',
      'cf-signed-token',
      'videodelivery.net',
      'iframe.videodelivery.net',
      'kraufanding-media.s3.amazonaws.com',
      'legacy-secret.mp4',
      'token=legacy',
    ]);
  });

  it('does not leak external YouTube embed data when a guest is denied on a LOGGED_IN video', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      tier: 'LOGGED_IN',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      assets: [{
        ...cloudflareAsset,
        provider: 'YOUTUBE',
        providerAssetId: null,
        providerPlaybackId: null,
        externalVideoId: 'dQw4w9WgXcQ',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }],
      asset: undefined,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'LOGIN_REQUIRED', requiredTier: 'LOGGED_IN' } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', guestCtx);

    expect(plan.status).toBe('LOGIN_REQUIRED');
    assertDeniedPlanHasNoPrivatePlaybackLeak(plan, [
      'youtube.com',
      'youtube-nocookie.com',
      'dQw4w9WgXcQ',
      'watch?v=',
    ]);
  });

  it('allows PUBLIC Cloudflare playback only through the signed private path and redacts raw provider IDs from the contract', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      tier: 'PUBLIC',
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/public-legacy-should-not-win.mp4',
      assets: [cloudflareAsset],
      asset: undefined,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true, reason: 'ALLOWED' } as any });
    mockCreateSignedPlaybackToken.mockReturnValue({ token: 'cf-public-signed-token', expiresAt: new Date('2026-06-26T01:00:00.000Z'), expiresInSeconds: 3600 });
    vi.mocked(prisma.videoPlaybackSession.create).mockResolvedValue({ id: 'public-session' } as any);

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', guestCtx);
    const serialized = JSON.stringify(plan);

    expect(plan.status).toBe('READY');
    expect(plan.source?.provider).toBe('CLOUDFLARE_STREAM');
    expect(plan.source?.playbackUrl).toBe('https://videodelivery.net/cf-public-signed-token/manifest/video.m3u8');
    expect(plan.source?.embedUrl).toBe('https://iframe.videodelivery.net/cf-public-signed-token');
    expect(plan.source?.isSignedUrl).toBe(true);
    expect(plan.source?.needsProxy).toBe(false);
    expect(plan.source?.asset?.providerAssetId).toBeNull();
    expect(plan.source?.asset?.providerPlaybackId).toBeNull();
    expect(serialized).not.toContain('cf-playback-id');
    expect(serialized).not.toContain('cf-asset-id');
    expect(serialized).not.toContain('public-legacy-should-not-win.mp4');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('fails closed when a PATRON video has YouTube as the primary source', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      tier: 'PATRON',
      videoUrl: null,
      assets: [{
        ...cloudflareAsset,
        provider: 'YOUTUBE',
        providerAssetId: null,
        providerPlaybackId: null,
        externalVideoId: 'dQw4w9WgXcQ',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }],
      asset: undefined,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true, reason: 'ALLOWED' } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', loggedInCtx);
    const serialized = JSON.stringify(plan);

    expect(plan.status).toBe('UNAVAILABLE');
    expect(plan.canPlay).toBe(false);
    expect(plan.access.allowed).toBe(true);
    expect(plan.source).toBeUndefined();
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.warnings).toContain('YouTube playback is not permitted for PATRON-tier videos');
    expect(serialized).not.toContain('youtube-nocookie.com');
    expect(serialized).not.toContain('watch?v=dQw4w9WgXcQ');
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
  });

  it('fails closed for legacy private fallback and does not bypass the patron paywall or sign storage URLs', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      tier: 'PATRON',
      videoUrl: 'https://kraufanding-media.s3.amazonaws.com/private-fallback.mp4?signature=legacy-secret',
      assets: [],
      asset: undefined,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: 'PATRON_REQUIRED', requiredTier: 'PATRON' } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', loggedInCtx);

    expect(plan.status).toBe('PATRON_REQUIRED');
    assertDeniedPlanHasNoPrivatePlaybackLeak(plan, [
      'private-fallback.mp4',
      'signature=legacy-secret',
      'kraufanding-media.s3.amazonaws.com',
      '/api/media/v1',
    ]);
  });
});
