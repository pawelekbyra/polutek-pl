import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoRepository } from '@/lib/modules/video/infrastructure/video.repository';
import { AccessTier, VideoStatus } from '@prisma/client';
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from '@/lib/modules/video/domain/video-asset.constants';

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
          creator: { status: { in: ['ACTIVE', 'LIMITED'] }, deletedAt: null }
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
          creator: { status: { in: ['ACTIVE', 'LIMITED'] }, deletedAt: null }
        }
      });
    });
  });

  describe('findAdminList filters', () => {
    it('should correctly filter by migrationStatus READY', async () => {
      mockDb.video.findMany = vi.fn().mockResolvedValue([]);
      mockDb.video.count = vi.fn().mockResolvedValue(0);

      await repository.findAdminList(mainChannelId, { migrationStatus: 'READY' });

      expect(mockDb.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          assets: { some: { isPrimary: true, provider: VIDEO_PROVIDER.SELF_HLS, processingState: VIDEO_ASSET_PROCESSING_STATE.READY } }
        })
      }));
    });

    it('should correctly filter by migrationStatus MIGRATION_REQUIRED (leftover asset of an unsupported provider)', async () => {
      mockDb.video.findMany = vi.fn().mockResolvedValue([]);
      mockDb.video.count = vi.fn().mockResolvedValue(0);

      await repository.findAdminList(mainChannelId, { migrationStatus: 'MIGRATION_REQUIRED' });

      expect(mockDb.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          assets: { some: { isPrimary: true, provider: { not: VIDEO_PROVIDER.SELF_HLS } } }
        })
      }));
    });

    it('should correctly filter by migrationStatus MISSING_SOURCE (no asset at all)', async () => {
      mockDb.video.findMany = vi.fn().mockResolvedValue([]);
      mockDb.video.count = vi.fn().mockResolvedValue(0);

      await repository.findAdminList(mainChannelId, { migrationStatus: 'MISSING_SOURCE' });

      expect(mockDb.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ assets: { none: {} } })
      }));
    });

    it('should combine a migrationStatus filter with a search query', async () => {
      mockDb.video.findMany = vi.fn().mockResolvedValue([]);
      mockDb.video.count = vi.fn().mockResolvedValue(0);

      await repository.findAdminList(mainChannelId, { migrationStatus: 'MIGRATION_REQUIRED', query: 'foo' });

      const { where } = mockDb.video.findMany.mock.calls[0][0];
      expect(where.assets).toEqual({ some: { isPrimary: true, provider: { not: VIDEO_PROVIDER.SELF_HLS } } });
      expect(where.OR).toEqual([
        { title: { contains: 'foo', mode: 'insensitive' } },
        { slug: { contains: 'foo', mode: 'insensitive' } }
      ]);
    });
  });
});

describe('VideoRepository asset foundation queries', () => {
  it('findByIdWithAsset includes the current VideoAsset metadata without playback/provider calls', async () => {
    const asset = {
      id: 'asset-1',
      videoId: 'v1',
      provider: 'SELF_HLS',
      objectKey: 'videos/v1/v/v1',
      processingState: 'READY',
      isPrimary: true,
      failureReason: null,
    };
    const db = {
      video: {
        findUnique: vi.fn().mockResolvedValue({ id: 'v1', assets: [asset] }),
      },
    } as any;
    const repository = new VideoRepository(db);

    const result = await repository.findByIdWithAsset('v1');

    expect(db.video.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      include: { assets: true, activePlaybackRoute: { include: { asset: true } } },
    });
    expect(result?.asset?.provider).toBe('SELF_HLS');
    expect(result?.asset?.objectKey).toBe('videos/v1/v/v1');
    expect(result?.asset?.processingState).toBe('READY');
  });
});
