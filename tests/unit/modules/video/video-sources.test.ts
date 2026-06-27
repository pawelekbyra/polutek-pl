import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractYouTubeVideoId, PLAYABLE_PROVIDERS } from '@/lib/modules/video/domain/video-asset.constants';
import { addVideoSource } from '@/lib/modules/video/application/add-video-source.use-case';
import { makeSourcePrimary } from '@/lib/modules/video/application/make-source-primary.use-case';
import { removeVideoSource } from '@/lib/modules/video/application/remove-video-source.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { VIDEO_ASSET_PROCESSING_STATE } from '@/lib/modules/video/domain/video-asset.constants';

// ─── extractYouTubeVideoId ────────────────────────────────────────────────────

describe('extractYouTubeVideoId', () => {
  it('extracts from standard watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtu.be shortlink', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from embed URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(extractYouTubeVideoId('not-a-url')).toBeNull();
  });

  it('returns null for youtube.com without v param', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/channel/UCxxx')).toBeNull();
  });
});

// ─── PLAYABLE_PROVIDERS ───────────────────────────────────────────────────────

describe('PLAYABLE_PROVIDERS', () => {
  it('includes CLOUDFLARE_STREAM and YOUTUBE', () => {
    expect(PLAYABLE_PROVIDERS).toContain('CLOUDFLARE_STREAM');
    expect(PLAYABLE_PROVIDERS).toContain('YOUTUBE');
  });

  it('does not include legacy providers', () => {
    expect(PLAYABLE_PROVIDERS).not.toContain('R2');
    expect(PLAYABLE_PROVIDERS).not.toContain('MUX');
    expect(PLAYABLE_PROVIDERS).not.toContain('S3');
  });
});

// ─── Shared mock factory ──────────────────────────────────────────────────────

function makeMockPrisma(overrides: any = {}) {
  const mock = {
    video: { findUnique: vi.fn(), findFirst: vi.fn() },
    videoAsset: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mock)),
    ...overrides,
  };
  return mock;
}

function makeCtx(prisma: any): AppContext {
  return { prisma, actor: { type: 'admin', userId: 'admin-1' } } as unknown as AppContext;
}

// ─── addVideoSource ───────────────────────────────────────────────────────────

describe('addVideoSource', () => {
  let prisma: any;
  let ctx: AppContext;

  beforeEach(() => {
    prisma = makeMockPrisma();
    ctx = makeCtx(prisma);
    vi.clearAllMocks();
  });

  const publicVideo = {
    id: 'video-1',
    tier: 'PUBLIC',
    assets: [],
    asset: null,
  };

  const patronVideo = {
    id: 'video-1',
    tier: 'PATRON',
    assets: [],
    asset: null,
  };

  it('adds a valid YouTube source to a PUBLIC video', async () => {
    prisma.video.findUnique.mockResolvedValue(publicVideo);
    prisma.videoAsset.findMany.mockResolvedValue([]);
    const newAsset = { id: 'asset-yt', provider: 'YOUTUBE', externalVideoId: 'dQw4w9WgXcQ' };
    prisma.videoAsset.create.mockResolvedValue(newAsset);

    const result = await addVideoSource(
      { videoId: 'video-1', provider: 'YOUTUBE', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      ctx
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.asset.provider).toBe('YOUTUBE');
  });

  it('rejects invalid YouTube URL', async () => {
    prisma.video.findUnique.mockResolvedValue(publicVideo);

    const result = await addVideoSource(
      { videoId: 'video-1', provider: 'YOUTUBE', youtubeUrl: 'https://vimeo.com/12345' },
      ctx
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('INVALID_YOUTUBE_URL');
  });

  it('rejects YouTube for PATRON video', async () => {
    prisma.video.findUnique.mockResolvedValue(patronVideo);

    const result = await addVideoSource(
      { videoId: 'video-1', provider: 'YOUTUBE', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      ctx
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('YOUTUBE_NOT_ALLOWED_FOR_PATRON');
  });

  it('rejects duplicate YouTube video ID', async () => {
    prisma.video.findUnique.mockResolvedValue(publicVideo);
    prisma.videoAsset.findMany.mockResolvedValue([
      { id: 'existing', provider: 'YOUTUBE', externalVideoId: 'dQw4w9WgXcQ' },
    ]);

    const result = await addVideoSource(
      { videoId: 'video-1', provider: 'YOUTUBE', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      ctx
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('DUPLICATE_YOUTUBE_SOURCE');
  });

  it('adds Cloudflare Stream source', async () => {
    prisma.video.findUnique.mockResolvedValue(publicVideo);
    prisma.videoAsset.findMany.mockResolvedValue([]);
    const newAsset = { id: 'asset-cf', provider: 'CLOUDFLARE_STREAM', providerAssetId: 'cf-uid' };
    prisma.videoAsset.create.mockResolvedValue(newAsset);

    const result = await addVideoSource(
      { videoId: 'video-1', provider: 'CLOUDFLARE_STREAM', providerAssetId: 'cf-uid' },
      ctx
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.asset.provider).toBe('CLOUDFLARE_STREAM');
  });

  it('rejects video not found', async () => {
    prisma.video.findUnique.mockResolvedValue(null);

    const result = await addVideoSource(
      { videoId: 'missing', provider: 'YOUTUBE', youtubeUrl: 'https://youtube.com/watch?v=abc' },
      ctx
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('VIDEO_NOT_FOUND');
  });
});

// ─── makeSourcePrimary ────────────────────────────────────────────────────────

describe('makeSourcePrimary', () => {
  let prisma: any;
  let ctx: AppContext;

  beforeEach(() => {
    prisma = makeMockPrisma();
    ctx = makeCtx(prisma);
    vi.clearAllMocks();
  });

  const readyCfAsset = {
    id: 'asset-cf',
    videoId: 'video-1',
    provider: 'CLOUDFLARE_STREAM',
    processingState: 'READY',
    isPrimary: false,
  };

  const readyYtAsset = {
    id: 'asset-yt',
    videoId: 'video-1',
    provider: 'YOUTUBE',
    processingState: 'READY',
    isPrimary: false,
    externalVideoId: 'abc',
  };

  const patronVideo = (assets: any[]) => ({
    id: 'video-1',
    tier: 'PATRON',
    assets,
    asset: null,
  });

  const publicVideo = (assets: any[]) => ({
    id: 'video-1',
    tier: 'PUBLIC',
    assets,
    asset: null,
  });

  it('sets READY Cloudflare asset as primary', async () => {
    prisma.video.findUnique.mockResolvedValue(publicVideo([readyCfAsset]));
    prisma.videoAsset.updateMany.mockResolvedValue({ count: 0 });
    prisma.videoAsset.update.mockResolvedValue({ ...readyCfAsset, isPrimary: true });

    const result = await makeSourcePrimary('video-1', 'asset-cf', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.asset.isPrimary).toBe(true);
  });

  it('rejects non-READY asset', async () => {
    const processingAsset = { ...readyCfAsset, processingState: 'PROCESSING' };
    prisma.video.findUnique.mockResolvedValue(publicVideo([processingAsset]));

    const result = await makeSourcePrimary('video-1', 'asset-cf', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('ASSET_NOT_READY');
  });

  it('rejects R2/MUX as primary (not playable)', async () => {
    const r2Asset = { id: 'asset-r2', videoId: 'video-1', provider: 'R2', processingState: 'READY', isPrimary: false };
    prisma.video.findUnique.mockResolvedValue(publicVideo([r2Asset]));

    const result = await makeSourcePrimary('video-1', 'asset-r2', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('PROVIDER_NOT_PLAYABLE');
  });

  it('rejects YouTube as primary for PATRON video', async () => {
    prisma.video.findUnique.mockResolvedValue(patronVideo([readyYtAsset]));

    const result = await makeSourcePrimary('video-1', 'asset-yt', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('YOUTUBE_NOT_ALLOWED_FOR_PATRON');
  });

  it('allows YouTube as primary for PUBLIC video', async () => {
    prisma.video.findUnique.mockResolvedValue(publicVideo([readyYtAsset]));
    prisma.videoAsset.updateMany.mockResolvedValue({ count: 0 });
    prisma.videoAsset.update.mockResolvedValue({ ...readyYtAsset, isPrimary: true });

    const result = await makeSourcePrimary('video-1', 'asset-yt', ctx);

    expect(result.ok).toBe(true);
  });
});

// ─── removeVideoSource ────────────────────────────────────────────────────────

describe('removeVideoSource', () => {
  let prisma: any;
  let ctx: AppContext;

  beforeEach(() => {
    prisma = makeMockPrisma();
    ctx = makeCtx(prisma);
    vi.clearAllMocks();
  });

  it('deletes a non-primary asset', async () => {
    prisma.videoAsset.findMany.mockResolvedValue([
      { id: 'asset-yt', videoId: 'video-1', provider: 'YOUTUBE', isPrimary: false },
    ]);
    prisma.videoAsset.delete.mockResolvedValue({});

    const result = await removeVideoSource('video-1', 'asset-yt', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.deleted).toBe(true);
  });

  it('rejects deleting the primary asset', async () => {
    prisma.videoAsset.findMany.mockResolvedValue([
      { id: 'asset-cf', videoId: 'video-1', provider: 'CLOUDFLARE_STREAM', isPrimary: true },
    ]);

    const result = await removeVideoSource('video-1', 'asset-cf', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('CANNOT_DELETE_PRIMARY');
  });

  it('rejects asset not found', async () => {
    prisma.videoAsset.findMany.mockResolvedValue([]);

    const result = await removeVideoSource('video-1', 'missing', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('ASSET_NOT_FOUND');
  });
});

// ─── Webhook: no override of existing READY primary ──────────────────────────

describe('handleCloudflareStreamWebhook - no override of READY primary', () => {
  it('does not promote asset if another READY primary exists', async () => {
    const { handleCloudflareStreamWebhook } = await import(
      '@/lib/modules/video/application/handle-cloudflare-webhook.use-case'
    );

    const processingAsset = {
      id: 'asset-processing',
      videoId: 'video-1',
      processingState: 'PROCESSING',
      providerPlaybackId: null,
      isPrimary: false,
    };

    const prisma = makeMockPrisma();
    prisma.videoAsset.findFirst
      .mockResolvedValueOnce(processingAsset)  // findAssetByProviderId
      .mockResolvedValueOnce({ id: 'asset-primary', isPrimary: true, processingState: 'READY' }); // existingReadyPrimary check

    prisma.videoAsset.update.mockResolvedValue({ ...processingAsset, processingState: 'READY', isPrimary: false });

    const ctx = makeCtx(prisma);

    const result = await handleCloudflareStreamWebhook(
      { uid: 'cf-uid', status: { state: 'ready' } },
      ctx
    );

    expect(result.ok).toBe(true);
    // updateMany (unset others) should NOT have been called since existing primary exists
    expect(prisma.videoAsset.updateMany).not.toHaveBeenCalled();
  });
});
