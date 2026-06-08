import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessPolicy } from '@/lib/access/access-policy';
import { prisma } from '@/lib/prisma';
import { AccessTier, VideoStatus } from '@prisma/client';
import { MainChannelService } from '@/lib/channel/main-channel.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../feature-flags', () => ({
  flags: {
    demoFallbacks: false,
    mainCreatorSlug: 'test-slug',
  },
}));

vi.mock('@/lib/channel/main-channel.service', () => ({
  MainChannelService: {
    getOptional: vi.fn(),
    getConfiguredSlug: vi.fn(() => 'test-slug'),
  },
}));

describe('AccessPolicy', () => {
  const mainChannel = { id: 'c1', slug: 'test-slug', isApproved: true, isPrimary: true };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MainChannelService.getOptional).mockResolvedValue(mainChannel as any);
  });

  describe('canViewVideo', () => {

    it('allows legacy PUBLIC videos with null publishedAt when status is PUBLISHED and on main channel', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        creatorId: 'c1',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        publishedAt: null,
        creator: mainChannel,
      } as any);

      const decision = await AccessPolicy.canViewVideo(null, 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('denies access to PUBLIC videos if NOT on main channel', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        creatorId: 'other-c',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
        creator: { id: 'other-c', isApproved: true, isPrimary: true },
      } as any);

      const decision = await AccessPolicy.canViewVideo(null, 'v1');
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('NOT_FOUND');
    });

    it('denies access to LOGGED_IN videos if not logged in', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        creatorId: 'c1',
        tier: AccessTier.LOGGED_IN,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
        creator: mainChannel,
      } as any);

      const decision = await AccessPolicy.canViewVideo(null, 'v1');
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('LOGIN_REQUIRED');
    });

    it('allows access to PATRON videos if user is a patron and on main channel', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        creatorId: 'c1',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
        creator: mainChannel,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'USER',
        isPatron: true,
        isDeleted: false,
      } as any);

      const decision = await AccessPolicy.canViewVideo('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('allows access to anything if user is an ADMIN, even if not on main channel', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        creatorId: 'other-c',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
        creator: { id: 'other-c', isApproved: true, isPrimary: true },
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'ADMIN',
        isDeleted: false,
      } as any);

      const decision = await AccessPolicy.canViewVideo('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });
  });
});
