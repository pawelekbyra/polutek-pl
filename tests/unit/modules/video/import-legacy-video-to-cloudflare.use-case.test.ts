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
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    videoAsset: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
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
    publishAfterAssetReady: false,
    publishAfterAssetReadyRequestedAt: null,
    publishAfterAssetReadyCompletedAt: null,
    publishAfterAssetReadyError: null,
    _count: { comments: 0 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'main-creator';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'channel-1', slug: 'main-creator', isApproved: true, isPrimary: true });
    mockPrisma.video.findFirst.mockResolvedValue(baseVideo);
    mockPrisma.video.findUnique.mockResolvedValue(baseVideo);
    mockPrisma.videoAsset.findFirst.mockResolvedValue(null);
    mockPrisma.videoAsset.findUnique.mockResolvedValue(null);
    mockPrisma.videoAsset.findMany.mockResolvedValue([]);
    mockPrisma.videoAsset.create.mockResolvedValue({ id: 'asset-1' });
    mockPrisma.videoAsset.update.mockResolvedValue({ id: 'asset-1' });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ result: { uid: 'cf-uid-123' } }),
    } as any);
  });

  it('imports legacy URL and creates a pending non-primary Cloudflare asset with provider UID', async () => {
    const result = await importLegacyVideoToCloudflare({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/copy'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          url: baseVideo.videoUrl,
        }),
      })
    );
    expect(mockPrisma.videoAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: 'cf-uid-123',
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: true,
      })
    }));
  });

  it('refuses import when legacy URL is missing', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, videoUrl: '' });

    const result = await importLegacyVideoToCloudflare({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('LEGACY_VIDEO_URL_REQUIRED');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses import when Cloudflare asset already exists', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({
      ...baseVideo,
      asset: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM }
    });

    const result = await importLegacyVideoToCloudflare({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLOUDFLARE_ASSET_ALREADY_EXISTS');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not expose raw private URL, provider secret, upload URL, or playback token in returned admin payload', async () => {
    const result = await importLegacyVideoToCloudflare({ videoId: 'video-1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const video = result.data;
      expect(video).not.toHaveProperty('playbackToken');
      expect(video).not.toHaveProperty('uploadUrl');
    }
  });
});
