import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importLegacyVideoToCloudflare } from '@/lib/modules/video/application/import-legacy-video-to-cloudflare.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from '@/lib/modules/video/domain/video-asset.constants';

global.fetch = vi.fn();

describe('importLegacyVideoToCloudflare', () => {
  const mockPrisma = {
    creator: {
      findUnique: vi.fn(),
    },
    video: {
      findFirst: vi.fn(),
    },
    videoAsset: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  };

  const ctx = {
    prisma: mockPrisma,
    actor: { type: 'ADMIN', userId: 'admin-1' },
  } as unknown as AppContext;

  const baseVideo = {
    id: 'video-1',
    creatorId: 'channel-1',
    title: 'Legacy video',
    slug: 'legacy-video',
    videoUrl: 'https://legacy.example.com/private-source.mp4',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    status: 'PUBLISHED',
    tier: 'PATRON',
    views: 0,
    likesCount: 0,
    dislikesCount: 0,
    publishedAt: new Date('2026-06-11T00:00:00Z'),
    isMainFeatured: false,
    showInSidebar: true,
    sidebarOrder: 1,
    createdAt: new Date('2026-06-11T00:00:00Z'),
    updatedAt: new Date('2026-06-11T00:00:00Z'),
    _count: { comments: 0 },
    asset: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'main-creator';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-1';
    process.env.CLOUDFLARE_API_TOKEN = 'secret-token';
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'channel-1', slug: 'main-creator', isApproved: true, isPrimary: true });
    mockPrisma.video.findFirst.mockResolvedValue(baseVideo);
    mockPrisma.videoAsset.findUnique.mockResolvedValue(null);
    mockPrisma.videoAsset.create.mockResolvedValue({ id: 'asset-1' });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, result: { uid: 'cloudflare-uid-1' }, errors: [], messages: [] }),
    });
  });

  it('imports legacy URL and creates a pending Cloudflare asset with provider UID', async () => {
    mockPrisma.video.findFirst
      .mockResolvedValueOnce(baseVideo)
      .mockResolvedValueOnce(baseVideo)
      .mockResolvedValueOnce({
        ...baseVideo,
        asset: {
          id: 'asset-1',
          videoId: baseVideo.id,
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          objectKey: 'cloudflare-stream/cloudflare-uid-1',
          providerAssetId: 'cloudflare-uid-1',
          providerPlaybackId: 'cloudflare-uid-1',
          processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
          isPrimary: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

    const result = await importLegacyVideoToCloudflare({ videoId: baseVideo.id }, ctx);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-1/stream/copy',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: baseVideo.videoUrl }),
      })
    );
    expect(mockPrisma.videoAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        videoId: baseVideo.id,
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        objectKey: 'cloudflare-stream/cloudflare-uid-1',
        providerAssetId: 'cloudflare-uid-1',
        providerPlaybackId: 'cloudflare-uid-1',
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: true,
      }),
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'VIDEO_CLOUDFLARE_LEGACY_IMPORT_STARTED',
      }),
    }));
  });

  it('refuses import when legacy URL is missing', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, videoUrl: '   ' });

    const result = await importLegacyVideoToCloudflare({ videoId: baseVideo.id }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('LEGACY_VIDEO_URL_REQUIRED');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
  });

  it('refuses import when Cloudflare asset already exists', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({
      ...baseVideo,
      asset: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.READY },
    });

    const result = await importLegacyVideoToCloudflare({ videoId: baseVideo.id }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLOUDFLARE_ASSET_ALREADY_EXISTS');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('prevents duplicate import when Cloudflare asset appears during transaction', async () => {
    mockPrisma.video.findFirst
      .mockResolvedValueOnce(baseVideo)
      .mockResolvedValueOnce({
        ...baseVideo,
        asset: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING },
      });

    const result = await importLegacyVideoToCloudflare({ videoId: baseVideo.id }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLOUDFLARE_ASSET_ALREADY_EXISTS');
    expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
  });

  it('does not expose raw private URL, provider secret, upload URL, or playback token in returned admin payload', async () => {
    mockPrisma.video.findFirst
      .mockResolvedValueOnce(baseVideo)
      .mockResolvedValueOnce(baseVideo)
      .mockResolvedValueOnce({
        ...baseVideo,
        asset: {
          id: 'asset-1',
          videoId: baseVideo.id,
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          objectKey: 'cloudflare-stream/cloudflare-uid-1',
          providerAssetId: 'cloudflare-uid-1',
          providerPlaybackId: 'cloudflare-uid-1',
          processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
          isPrimary: true,
          playbackToken: 'should-not-leak',
          signedUrl: 'https://signed.example/leak',
          uploadUrl: 'https://upload.cloudflare.com/leak',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

    const result = await importLegacyVideoToCloudflare({ videoId: baseVideo.id }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.videoUrl).toBe(baseVideo.videoUrl);
      expect((result.data.asset as any).playbackToken).toBeUndefined();
      expect((result.data.asset as any).signedUrl).toBeUndefined();
      expect((result.data.asset as any).uploadUrl).toBeUndefined();
      expect(JSON.stringify(result.data)).not.toContain('secret-token');
    }
  });
});
