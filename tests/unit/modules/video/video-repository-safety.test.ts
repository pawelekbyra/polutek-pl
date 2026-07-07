import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoRepository } from '@/lib/modules/video/infrastructure/video.repository';
import { VideoNotOnMainChannelError, VideoInvalidHeroError } from '@/lib/modules/video/domain/video.errors';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('VideoRepository Safety', () => {
  let repository: VideoRepository;
  let mockPrisma: any;
  const mainChannelId = 'main-channel-id';

  beforeEach(() => {
    mockPrisma = {
      video: {
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    repository = new VideoRepository(mockPrisma);
  });

  describe('updateForMainChannel', () => {
    it('updates video when id and creatorId match', async () => {
      mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.video.findFirst.mockResolvedValue({ id: 'v1', creatorId: mainChannelId });

      const result = await repository.updateForMainChannel({ id: 'v1', title: 'New Title' }, mainChannelId, mockPrisma);

      expect(mockPrisma.video.updateMany).toHaveBeenCalledWith({
        where: { id: 'v1', creatorId: mainChannelId },
        data: expect.objectContaining({ title: 'New Title' }),
      });
      expect(result.id).toBe('v1');
    });

    it('throws VideoNotOnMainChannelError when updateMany count is not 1', async () => {
      mockPrisma.video.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.updateForMainChannel({ id: 'v1', title: 'New Title' }, mainChannelId, mockPrisma))
        .rejects.toThrow(VideoNotOnMainChannelError);
    });
  });

  describe('archiveVideo', () => {
    it('archives only main-channel video and includes comments count', async () => {
      mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.video.findFirst.mockResolvedValue({ id: 'v1', status: 'ARCHIVED', _count: { comments: 0 } });

      const result = await repository.archiveVideo('v1', mainChannelId, mockPrisma);

      expect(mockPrisma.video.updateMany).toHaveBeenCalledWith({
        where: { id: 'v1', creatorId: mainChannelId },
        data: { status: 'ARCHIVED', isMainFeatured: false, showInSidebar: false },
      });
      expect(mockPrisma.video.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          include: { _count: { select: { comments: true } } }
      }));
      expect(result.status).toBe('ARCHIVED');
    });

    it('throws VideoNotOnMainChannelError for off-channel video', async () => {
      mockPrisma.video.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.archiveVideo('v1', mainChannelId, mockPrisma))
        .rejects.toThrow(VideoNotOnMainChannelError);
    });
  });

  describe('setHero', () => {
    it('refuses off-channel video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(null);

      await expect(repository.setHero('v1', mainChannelId, mockPrisma))
        .rejects.toThrow(VideoNotOnMainChannelError);
    });

    it('refuses non-public/non-published video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'v1',
        title: 'Title',
        slug: 'slug',
        creatorId: mainChannelId,
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        asset: { isPrimary: true, processingState: 'READY', provider: 'CLOUDFLARE_STREAM', providerAssetId: 'v123' },
        activePlaybackRoute: { asset: { processingState: 'READY', provider: 'CLOUDFLARE_STREAM', providerAssetId: 'v123' } }
      });

      await expect(repository.setHero('v1', mainChannelId, mockPrisma))
        .rejects.toThrow(VideoInvalidHeroError);
    });

    it('sets hero for valid video and enforces scoping on update', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({
        id: 'v1',
        title: 'Title',
        slug: 'slug',
        creatorId: mainChannelId,
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        asset: { isPrimary: true, processingState: 'READY', provider: 'CLOUDFLARE_STREAM', providerAssetId: 'v123' },
        activePlaybackRoute: { asset: { processingState: 'READY', provider: 'CLOUDFLARE_STREAM', providerAssetId: 'v123' } }
      });
      mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });

      await repository.setHero('v1', mainChannelId, mockPrisma);

      expect(mockPrisma.video.updateMany).toHaveBeenCalledWith({
        where: { creatorId: mainChannelId, isMainFeatured: true },
        data: { isMainFeatured: false }
      });
      expect(mockPrisma.video.updateMany).toHaveBeenCalledWith({
        where: { id: 'v1', creatorId: mainChannelId },
        data: { isMainFeatured: true }
      });
    });
  });

  describe('reorder', () => {
    it('refuses mixed-channel batch', async () => {
      mockPrisma.video.findUnique.mockResolvedValueOnce({ creatorId: mainChannelId, status: VideoStatus.PUBLISHED });
      mockPrisma.video.findUnique.mockResolvedValueOnce({ creatorId: 'other-channel', status: VideoStatus.PUBLISHED });

      const updates = [
        { id: 'v1', sidebarOrder: 1, showInSidebar: true },
        { id: 'v2', sidebarOrder: 2, showInSidebar: true },
      ];

      await expect(repository.reorder(updates, mainChannelId, mockPrisma))
        .rejects.toThrow(VideoNotOnMainChannelError);
    });
  });
});
