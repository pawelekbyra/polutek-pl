import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoRepository } from '@/lib/modules/video/infrastructure/video.repository';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('VideoRepository Predicates', () => {
  const mockDb = {
    video: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  } as any;

  const repository = new VideoRepository(mockDb);
  const mainChannelId = 'c1';
  const now = new Date('2024-05-22T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findPublicList', () => {
    it('should include all required filters and ordering', async () => {
      await repository.findPublicList(mainChannelId, now);

      expect(mockDb.video.findMany).toHaveBeenCalledWith({
        where: {
          creatorId: mainChannelId,
          status: VideoStatus.PUBLISHED,
          OR: [
            { publishedAt: null },
            { publishedAt: { lte: now } }
          ],
          showInSidebar: true,
          tier: { in: [AccessTier.PUBLIC, AccessTier.LOGGED_IN, AccessTier.PATRON] },
          creator: {
            isApproved: true,
            isPrimary: true
          }
        },
        orderBy: [
          { sidebarOrder: 'asc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ]
      });
    });
  });

  describe('findHero', () => {
    it('should include all required filters for hero', async () => {
      await repository.findHero(mainChannelId, now);

      expect(mockDb.video.findFirst).toHaveBeenCalledWith({
        where: {
          creatorId: mainChannelId,
          isMainFeatured: true,
          status: VideoStatus.PUBLISHED,
          tier: AccessTier.PUBLIC,
          OR: [
            { publishedAt: null },
            { publishedAt: { lte: now } }
          ],
          creator: {
            isApproved: true,
            isPrimary: true
          }
        }
      });
    });
  });
});

describe('VideoRepository asset foundation queries', () => {
  it('findByIdWithAsset includes the current VideoAsset metadata without playback/provider calls', async () => {
    const asset = {
      id: 'asset-1',
      videoId: 'v1',
      provider: 'CLOUDFLARE_STREAM',
      objectKey: 'cloudflare-stream/cf-video-uid',
      providerAssetId: 'cf-video-uid',
      providerPlaybackId: 'cf-playback-uid',
      processingState: 'READY',
      isPrimary: true,
      failureReason: null,
    };
    const db = {
      video: {
        findUnique: vi.fn().mockResolvedValue({ id: 'v1', asset }),
      },
    } as any;
    const repository = new VideoRepository(db);

    const result = await repository.findByIdWithAsset('v1');

    expect(db.video.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      include: { asset: true },
    });
    expect(result?.asset?.provider).toBe('CLOUDFLARE_STREAM');
    expect(result?.asset?.providerAssetId).toBe('cf-video-uid');
    expect(result?.asset?.providerPlaybackId).toBe('cf-playback-uid');
    expect(result?.asset?.processingState).toBe('READY');
  });
});
