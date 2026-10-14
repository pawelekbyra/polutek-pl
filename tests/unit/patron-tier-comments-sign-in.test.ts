import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listVideoComments } from '@/lib/modules/comments/application/list-video-comments.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getPatronStatus } from '@/lib/modules/patron';
import { MainChannelService } from '@/lib/modules/channel';
import { AccessTier, VideoStatus } from '@prisma/client';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/modules/patron', () => ({
  getPatronStatus: vi.fn(),
}));

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

describe('PATRON tier comments need sign-in only', () => {
  const prismaMock = {
    video: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    creator: {
      findFirst: vi.fn(),
    }
  } as any;

  const mockMainChannel = { id: 'c1' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MainChannelService.getRequired).mockResolvedValue(mockMainChannel as any);
  });

  describe('listVideoComments viewer state', () => {
    it('lets a signed-in user without any PatronGrant comment on a PATRON video', async () => {
      // Mock actor with stale Clerk claim isPatron: true
      const ctx = createAppContext({
        prisma: prismaMock,
        actor: { type: 'user', userId: 'u1' },
      });

      prismaMock.video.findUnique.mockResolvedValue({ id: 'v1', slug: 'v1-slug' });
      prismaMock.video.findFirst.mockResolvedValue({
        id: 'v1',
        creatorId: 'c1',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        creator: { id: 'c1', status: 'ACTIVE' },
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        isPatron: false,
        isDeleted: false,
      });

      // Grant truth says NO
      vi.mocked(getPatronStatus).mockResolvedValue(ok({
        userId: 'u1',
        isPatron: false,
        activeGrants: [],
        normalizedTotal: 0,
        patronSince: null,
        patronSource: null,
      }));

      // listVideoComments uses CommentRepository which uses prisma.comment.findMany / count
      prismaMock.comment.findMany.mockResolvedValue([]);
      prismaMock.comment.count.mockResolvedValue(0);
      // It also uses findVideoCreatorId which uses prisma.video.findUnique
      prismaMock.video.findUnique.mockResolvedValue({ creatorId: 'c1', creator: { userId: 'creator-1' } });

      const result = await listVideoComments({ videoId: 'v1', sortBy: 'newest', limit: 10 }, ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Support grants nothing (CLAUDE.md §4.4): sign-in alone allows commenting.
        expect(result.data.viewer.canComment).toBe(true);
      }
    });
  });
});
