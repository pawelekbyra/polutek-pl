import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachCloudflareAsset } from '@/lib/modules/video/application/attach-cloudflare-asset.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';
import { VIDEO_PROVIDER } from '@/lib/modules/video/domain/video-asset.constants';

describe('attachCloudflareAsset', () => {
  const mockPrisma = {
    creator: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    video: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'main-creator';
    mockPrisma.creator.findUnique.mockResolvedValue({ id: 'channel-1', slug: 'main-creator', isApproved: true, isPrimary: true });
  });

  it('successfully attaches a Cloudflare asset to a video', async () => {
    const videoId = 'video-1';
    const video = { id: videoId, creatorId: 'channel-1', title: 'Test Video', slug: 'test-video', videoUrl: 'https://example.com/video.mp4' };
    mockPrisma.video.findFirst.mockResolvedValue(video);
    mockPrisma.videoAsset.findUnique.mockResolvedValue(null);
    mockPrisma.videoAsset.create.mockResolvedValue({ id: 'asset-1' });

    const result = await attachCloudflareAsset({
      videoId,
      providerAssetId: 'cf-uid-123',
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.videoAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: 'cf-uid-123',
        videoId,
      })
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
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
