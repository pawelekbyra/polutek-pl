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
