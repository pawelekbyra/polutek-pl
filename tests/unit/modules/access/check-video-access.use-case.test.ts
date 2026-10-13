import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { MainChannelService } from '@/lib/modules/channel';
import { AccessTier, VideoStatus } from '@prisma/client';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

describe('checkVideoAccess Use Case Matrix', () => {
  let mockPrisma: any;
  const mainChannel = { id: 'main-channel-id' };
  const now = new Date('2026-01-01T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      video: {
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    };
    (MainChannelService.getRequired as any).mockResolvedValue(mainChannel);
  });

  const baseVideo = {
    id: 'v1',
    creatorId: mainChannel.id,
    status: VideoStatus.PUBLISHED,
    tier: AccessTier.PUBLIC,
    publishedAt: new Date(now.getTime() - 1000),
    creator: { id: mainChannel.id, isApproved: true, isPrimary: true }
  };

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma, now: () => now });

  describe('Public Tier', () => {
    it('allows guest to see public published video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(baseVideo);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('allows logged-in user to see public published video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(baseVideo);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('allows admin to see public published video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(baseVideo);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'admin', userId: 'a1' }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });
  });

  describe('Logged-in Tier', () => {
    const loggedInVideo = { ...baseVideo, tier: AccessTier.LOGGED_IN };

    it('denies guest with LOGIN_REQUIRED', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(loggedInVideo);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('LOGIN_REQUIRED');
      }
    });

    it('allows local user', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(loggedInVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('denies deleted user with DELETED', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(loggedInVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: true });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('DELETED');
      }
    });
  });

  describe('leftover PATRON tier value (two levels since 2026-10-04: read as LOGGED_IN)', () => {
    const patronVideo = { ...baseVideo, tier: AccessTier.PATRON };

    it('denies guest with LOGIN_REQUIRED and reports LOGGED_IN as the required level', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('LOGIN_REQUIRED');
        expect(result.data.requiredTier).toBe('LOGGED_IN');
      }
    });

    it('allows any signed-in user regardless of PatronGrant', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false });

      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('denies for missing local user', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('FORBIDDEN');
      }
    });

    it('denies deleted user with DELETED', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: true });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('DELETED');
      }
    });
  });

  describe('Admin and Scoping', () => {
    it('admin can access draft main-channel video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, status: VideoStatus.DRAFT });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'admin', userId: 'a1' }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('admin can access future main-channel video', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, publishedAt: new Date(now.getTime() + 10000) });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'admin', userId: 'a1' }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('admin cannot access off-channel video (NOT_FOUND)', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(null); // findFirst with creatorId: mainChannel.id returns null
      const result = await checkVideoAccess({ videoIdOrSlug: 'off-v1' }, createCtx({ type: 'admin', userId: 'a1' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
      }
    });
  });

  describe('Visibility and Status', () => {
    it('archived video returns NOT_FOUND', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, status: VideoStatus.ARCHIVED });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'admin', userId: 'a1' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
      }
    });

    it('draft video returns NOT_FOUND for non-admin', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, status: VideoStatus.DRAFT });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
      }
    });

    it('future published video returns NOT_FOUND for non-admin', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, publishedAt: new Date(now.getTime() + 10000) });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
      }
    });

    it('missing video returns NOT_FOUND', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(null);
      const result = await checkVideoAccess({ videoIdOrSlug: 'missing' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
      }
    });

    it('a video of a channel that is not public returns NOT_FOUND for a non-member', async () => {
        for (const creator of [
          { id: 'other', userId: 'owner-x', isApproved: false, isPrimary: false, status: 'PENDING_REVIEW' },
          { id: 'other', userId: 'owner-x', isApproved: true, isPrimary: false, status: 'SUSPENDED' },
          { id: 'other', userId: 'owner-x', isApproved: true, isPrimary: false, status: 'ACTIVE', deletedAt: new Date(now.getTime() - 1000) },
        ]) {
          mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, creatorId: 'other', creator });
          const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
          expect(result.ok && result.data.hasAccess, creator.status).toBe(false);
          expect(result.ok && result.data.reason, creator.status).toBe('NOT_FOUND');
        }
    });

    it('serves a video of ANY public channel (the channel comes from the video, not from the site)', async () => {
        mockPrisma.video.findFirst.mockResolvedValue({
          ...baseVideo,
          creatorId: 'other',
          creator: { id: 'other', userId: 'owner-x', isApproved: true, isPrimary: false, status: 'ACTIVE' },
        });
        const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));
        expect(result.ok && result.data.hasAccess).toBe(true);
    });

    it('lets the channel owner (and staff) open a draft, nobody else', async () => {
        const draft = {
          ...baseVideo,
          status: VideoStatus.DRAFT,
          publishedAt: null,
          creatorId: 'other',
          creator: { id: 'other', userId: 'owner-x', isApproved: true, isPrimary: false, status: 'ACTIVE' },
        };
        mockPrisma.video.findFirst.mockResolvedValue(draft);
        const owner = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'owner-x' }));
        expect(owner.ok && owner.data.hasAccess).toBe(true);
        const stranger = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));
        expect(stranger.ok && stranger.data.reason).toBe('NOT_FOUND');
        const staff = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'admin', userId: 'a1' }));
        expect(staff.ok && staff.data.hasAccess).toBe(true);
    });

    it('hides a REMOVED video from everyone but staff', async () => {
        const removed = { ...baseVideo, moderationStatus: 'REMOVED' };
        mockPrisma.video.findFirst.mockResolvedValue(removed);
        const guest = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));
        expect(guest.ok && guest.data.reason).toBe('NOT_FOUND');
        mockPrisma.video.findFirst.mockResolvedValue({ ...removed, creator: { ...baseVideo.creator, userId: 'owner-x' } });
        const owner = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'owner-x' }));
        expect(owner.ok && owner.data.reason).toBe('NOT_FOUND');
        const staff = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'admin', userId: 'a1' }));
        expect(staff.ok && staff.data.hasAccess).toBe(true);
    });

    it('asks a guest to sign in for an age-restricted video', async () => {
        mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, moderationStatus: 'AGE_RESTRICTED' });
        const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));
        expect(result.ok && result.data.hasAccess).toBe(false);
        expect(result.ok && result.data.reason).toBe('LOGIN_REQUIRED');
    });
  });

  describe("Premiere (SEC-10: same decision for id and slug)", () => {
    const premiereAt = new Date(now.getTime() + 86_400_000);
    const upcoming = { ...baseVideo, id: "3f2a1b4c-0000-4000-8000-000000000001", slug: "premiera", premiereAt };

    it("resolves a slug to the row id and reports the upcoming premiere", async () => {
      mockPrisma.video.findFirst.mockResolvedValue(upcoming);
      const result = await checkVideoAccess({ videoIdOrSlug: "premiera" }, createCtx({ type: "guest" }));
      expect(mockPrisma.video.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: "premiera" } }));
      expect(result.ok && result.data).toEqual({ hasAccess: true, videoId: upcoming.id, premiereAt: premiereAt.toISOString() });
    });

    it("gives the same answer for the id", async () => {
      mockPrisma.video.findFirst.mockResolvedValue({ ...upcoming, tier: AccessTier.PATRON });
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", isDeleted: false });
      const result = await checkVideoAccess({ videoIdOrSlug: upcoming.id }, createCtx({ type: "user", userId: "u1" }));
      expect(result.ok && result.data.hasAccess).toBe(true);
      expect(result.ok && result.data.premiereAt).toBe(premiereAt.toISOString());
      expect(result.ok && result.data.videoId).toBe(upcoming.id);
    });

    it("does not flag a premiere for admins or once it has passed", async () => {
      mockPrisma.video.findFirst.mockResolvedValue(upcoming);
      const admin = await checkVideoAccess({ videoIdOrSlug: "premiera" }, createCtx({ type: "admin", userId: "a1" }));
      expect(admin.ok && admin.data.premiereAt).toBeUndefined();
      mockPrisma.video.findFirst.mockResolvedValue({ ...upcoming, premiereAt: new Date(now.getTime() - 1000) });
      const guest = await checkVideoAccess({ videoIdOrSlug: "premiera" }, createCtx({ type: "guest" }));
      expect(guest.ok && guest.data.premiereAt).toBeUndefined();
    });
  });
});
