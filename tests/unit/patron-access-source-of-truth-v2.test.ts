import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
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

describe('Patron Access Source of Truth - checkVideoAccess (Narrow Follow-up)', () => {
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

  it('grants access when PatronGrant is active, even if User.isPatron cache in DB is false', async () => {
    const ctx = createAppContext({
      prisma: prismaMock,
      actor: { type: 'user', userId: 'u1', isPatron: false }, // Clerk claim is false
    });

    prismaMock.video.findFirst.mockResolvedValue({
      id: 'v1',
      creatorId: 'c1',
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creator: { isApproved: true, isPrimary: true },
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      isPatron: false, // DB legacy cache is false
      isDeleted: false,
    });

    vi.mocked(getPatronStatus).mockResolvedValue({
      ok: true,
      data: {
        userId: 'u1',
        isPatron: true,
        activeGrants: [{ id: 'g1' } as any],
        normalizedTotal: 100,
      } as any,
    });

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected checkVideoAccess to return ok result');
    expect(result.data.hasAccess).toBe(true);
  });

  it('denies access when PatronGrant is missing, even if User.isPatron cache in DB is true', async () => {
    const ctx = createAppContext({
      prisma: prismaMock,
      actor: { type: 'user', userId: 'u1', isPatron: true }, // Clerk claim is true
    });

    prismaMock.video.findFirst.mockResolvedValue({
      id: 'v1',
      creatorId: 'c1',
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creator: { isApproved: true, isPrimary: true },
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      isPatron: true, // DB legacy cache is true
      isDeleted: false,
    });

    vi.mocked(getPatronStatus).mockResolvedValue({
      ok: true,
      data: {
        userId: 'u1',
        isPatron: false,
        activeGrants: [], // No active grants
        normalizedTotal: 0,
      } as any,
    });

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected checkVideoAccess to return ok result');
    expect(result.data.hasAccess).toBe(false);
    expect(result.data.reason).toBe('PATRON_REQUIRED');
  });

  it('denies access when PatronGrant is missing, even if Clerk actor claim says isPatron: true', async () => {
    const ctx = createAppContext({
      prisma: prismaMock,
      actor: { type: 'user', userId: 'u1', isPatron: true }, // Clerk claim
    });

    prismaMock.video.findFirst.mockResolvedValue({
      id: 'v1',
      creatorId: 'c1',
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creator: { isApproved: true, isPrimary: true },
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      isPatron: false,
      isDeleted: false,
    });

    vi.mocked(getPatronStatus).mockResolvedValue({
      ok: true,
      data: {
        userId: 'u1',
        isPatron: false,
        activeGrants: [],
        normalizedTotal: 0,
      } as any,
    });

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected checkVideoAccess to return ok result');
    expect(result.data.hasAccess).toBe(false);
  });

  describe('listVideoComments viewer state', () => {
    it('returns canComment: false when backend access is denied even if Clerk claim says true', async () => {
      // Mock actor with stale Clerk claim isPatron: true
      const ctx = createAppContext({
        prisma: prismaMock,
        actor: { type: 'user', userId: 'u1', isPatron: true },
      });

      prismaMock.video.findUnique.mockResolvedValue({ id: 'v1', slug: 'v1-slug' });
      prismaMock.video.findFirst.mockResolvedValue({
        id: 'v1',
        creatorId: 'c1',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        creator: { id: 'c1', isApproved: true, isPrimary: true },
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
        // Backend truth (PatronGrant) said NO, so canComment must be FALSE
        // despite actor.isPatron being TRUE.
        expect(result.data.viewer.canComment).toBe(false);
      }
    });
  });
});
