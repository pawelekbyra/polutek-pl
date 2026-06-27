import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachCloudflareAsset } from '@/lib/modules/video/application/attach-cloudflare-asset.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from '@/lib/modules/video/domain/video-asset.constants';

const baseVideo = {
  id: 'video-1',
  creatorId: 'channel-1',
  title: 'Test Video',
  slug: 'test-video',
  videoUrl: 'https://example.com/video.mp4',
  thumbnailUrl: '/thumb.jpg',
  tier: 'PATRON',
  status: 'DRAFT',
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  publishedAt: null,
  isMainFeatured: false,
  showInSidebar: false,
  sidebarOrder: 0,
  createdAt: new Date('2026-06-11T00:00:00Z'),
  updatedAt: new Date('2026-06-11T00:00:00Z'),
  _count: { comments: 0 },
  asset: null,
};

describe('attachCloudflareAsset', () => {
  const mockPrisma = {
    creator: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    video: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
    db: {
      read: mockPrisma,
      writeTransaction: (cb: any) => cb(mockPrisma),
    },
  } as unknown as AppContext;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'main-creator';
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'channel-1', slug: 'main-creator', isApproved: true, isPrimary: true });
    mockPrisma.video.findFirst.mockResolvedValue(baseVideo);
    mockPrisma.videoAsset.findFirst.mockResolvedValue(null);
    mockPrisma.videoAsset.findUnique.mockResolvedValue(null);
    mockPrisma.videoAsset.findMany.mockResolvedValue([]);
    mockPrisma.videoAsset.create.mockResolvedValue({ id: 'asset-1' });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('successfully attaches a Cloudflare asset to a video', async () => {
    const videoId = 'video-1';

    const result = await attachCloudflareAsset({
      videoId,
      providerAssetId: 'cf-uid-123',
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.videoAsset.findFirst).toHaveBeenCalledWith({
      where: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, providerAssetId: 'cf-uid-123' },
    });
    expect(mockPrisma.videoAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: 'cf-uid-123',
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: true,
        videoId,
      })
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('does not fake readiness when attaching an asset without an explicit provider state', async () => {
    const videoId = 'video-1';

    await attachCloudflareAsset({ videoId, providerAssetId: ' cf-uid-123 ' }, ctx);

    expect(mockPrisma.videoAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        providerAssetId: 'cf-uid-123',
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: true,
      })
    }));
  });

  it('rejects attaching a UID already used by another video', async () => {
    mockPrisma.videoAsset.findFirst.mockResolvedValue({
      id: 'asset-other',
      videoId: 'other-video',
      provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
      providerAssetId: 'cf-uid-123',
    });

    const result = await attachCloudflareAsset({
      videoId: 'video-1',
      providerAssetId: 'cf-uid-123',
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CLOUDFLARE_ASSET_IN_USE');
    }
    expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
  });

  it('does not demote an existing ready primary Cloudflare asset on manual attach', async () => {
    const videoId = 'video-1';
    mockPrisma.video.findFirst.mockResolvedValue({
      ...baseVideo,
      id: videoId,
      asset: {
        id: 'asset-1',
        videoId,
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: 'ready-uid',
        processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
        isPrimary: true,
      },
    });

    const result = await attachCloudflareAsset({
      videoId,
      providerAssetId: 'replacement-uid',
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_HAS_READY_ASSET');
    }
    expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('is idempotent when the same Cloudflare UID is already attached to this video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({
      ...baseVideo,
      asset: {
        id: 'asset-1',
        videoId: baseVideo.id,
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: 'cf-uid-123',
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
        isPrimary: false,
      },
    });

    const result = await attachCloudflareAsset({
      videoId: 'video-1',
      providerAssetId: 'cf-uid-123',
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.videoAsset.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.create).not.toHaveBeenCalled();
    expect(mockPrisma.videoAsset.update).not.toHaveBeenCalled();
  });

  it('rejects an empty Cloudflare provider asset id', async () => {
    const result = await attachCloudflareAsset({
      videoId: 'video-1',
      providerAssetId: '   ',
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PROVIDER_ASSET_ID');
    }
    expect(mockPrisma.video.findFirst).not.toHaveBeenCalled();
  });

  it('fails if video is not found on main channel', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(null);

    const result = await attachCloudflareAsset({
      videoId: 'non-existent',
      providerAssetId: 'cf-uid-123',
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VIDEO_NOT_FOUND');
    }
  });
});
