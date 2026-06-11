import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { prisma } from '@/lib/prisma';
import { StorageService } from '@/lib/services/storage/storage.service';

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

vi.mock('@/lib/services/storage/storage.service', () => ({
  StorageService: {
    getPresignedUrl: vi.fn(),
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

  it('should not return source, session, or provider data if access is denied', async () => {
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
    expect(plan.diagnostics.asset?.providerAssetId).toBe('cf-asset-id');
    expect(StorageService.getPresignedUrl).not.toHaveBeenCalled();
    expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
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

  it('exposes only safe provider metadata for allowed READY Cloudflare asset without resolving provider source or token', async () => {
    vi.mocked(prisma.video.findUnique).mockResolvedValue({
      ...baseVideo,
      asset: cloudflareAsset,
    } as any);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true } as any });

    const plan = await PlaybackService.createPlaybackPlanWithContext('v1', ctx);

    expect(plan.status).toBe('READY');
    expect(plan.access.allowed).toBe(true);
    expect(plan.source?.provider).toBe('CLOUDFLARE_STREAM');
    expect(plan.source?.asset?.providerPlaybackId).toBe('cf-playback-id');
    expect(plan.source?.playbackUrl).toBeUndefined();
    expect((plan.source as any)?.playbackToken).toBeUndefined();
    expect(JSON.stringify(plan)).not.toContain('cloudflare/cf-provider-object-key');
    expect(plan.tracking.playbackSessionId).toBe('');
    expect(plan.diagnostics.providerResolutionAllowed).toBe(true);
    expect(plan.diagnostics.providerResolutionAttempted).toBe(false);
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
});
