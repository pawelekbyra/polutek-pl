import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessPolicy } from '@/lib/access/access-policy';
import { prisma } from '@/lib/prisma';
import { AccessTier, VideoStatus } from '@prisma/client';

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
  },
}));

describe('AccessPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canViewVideo', () => {

    it('allows legacy PUBLIC videos with null publishedAt when status is PUBLISHED', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        publishedAt: null,
      } as any);

      const decision = await AccessPolicy.canViewVideo(null, 'v1');
      expect(decision.allowed).toBe(true);
    });
    it('allows access to PUBLIC videos even if not logged in', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      const decision = await AccessPolicy.canViewVideo(null, 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('denies access to LOGGED_IN videos if not logged in', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.LOGGED_IN,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      const decision = await AccessPolicy.canViewVideo(null, 'v1');
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('LOGIN_REQUIRED');
    });

    it('allows access to LOGGED_IN videos if logged in', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.LOGGED_IN,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'USER',
        isDeleted: false,
      } as any);

      const decision = await AccessPolicy.canViewVideo('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });


    it('allows LOGGED_IN video viewing for authenticated users before local profile sync', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.LOGGED_IN,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const decision = await AccessPolicy.canViewVideo('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('allows commenting on LOGGED_IN videos for authenticated users before local profile sync', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.LOGGED_IN,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const decision = await AccessPolicy.canComment('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('denies access to PATRON videos if user is not a patron', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'USER',
        isPatron: false,
        isDeleted: false,
      } as any);

      const decision = await AccessPolicy.canViewVideo('u1', 'v1');
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('PATRON_REQUIRED');
    });

    it('allows access to PATRON videos if user is a patron', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
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

    it('allows access to anything if user is an ADMIN', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'ADMIN',
        isDeleted: false,
      } as any);

      const decision = await AccessPolicy.canViewVideo('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('allows commenting on PUBLIC videos for logged-in non-patrons', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.PUBLIC,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      const decision = await AccessPolicy.canComment('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('allows commenting on LOGGED_IN videos for logged-in non-patrons', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.LOGGED_IN,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'USER',
        isPatron: false,
        referralPoints: 0,
        isDeleted: false,
      } as any);

      const decision = await AccessPolicy.canComment('u1', 'v1');
      expect(decision.allowed).toBe(true);
    });

    it('denies commenting on PATRON videos for logged-in non-patrons', async () => {
      vi.mocked(prisma.video.findUnique).mockResolvedValue({
        id: 'v1',
        tier: AccessTier.PATRON,
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000),
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        role: 'USER',
        isPatron: false,
        referralPoints: 0,
        isDeleted: false,
      } as any);

      const decision = await AccessPolicy.canComment('u1', 'v1');
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('PATRON_REQUIRED');
    });
  });
});
