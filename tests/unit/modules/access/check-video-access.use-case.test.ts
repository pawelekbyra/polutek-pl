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
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
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
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('denies deleted user with DELETED', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(loggedInVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: true });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('DELETED');
      }
    });
  });

  describe('Patron Tier', () => {
    const patronVideo = { ...baseVideo, tier: AccessTier.PATRON };

    it('denies guest with PATRON_REQUIRED (standard project behavior)', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('PATRON_REQUIRED');
      }
    });

    it('denies logged-in non-patron with PATRON_REQUIRED', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false, isPatron: false });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('PATRON_REQUIRED');
      }
    });

    it('allows patron based on DB state', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false, isPatron: true });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.hasAccess).toBe(true);
    });

    it('denies when actor cache is true but DB is false', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false, isPatron: false });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: true }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('PATRON_REQUIRED');
      }
    });

    it('denies for missing local user', async () => {
      mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('FORBIDDEN');
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
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
      }
    });

    it('future published video returns NOT_FOUND for non-admin', async () => {
      mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, publishedAt: new Date(now.getTime() + 10000) });
      const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
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

    it('off-channel video returns NOT_FOUND for non-admin', async () => {
        mockPrisma.video.findFirst.mockResolvedValue({
            ...baseVideo,
            creatorId: 'other',
            creator: { id: 'other', isApproved: true, isPrimary: true }
        });
        // Note: findFirst in checkVideoAccess already scopes to mainChannelId, but if it didn't:
        const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1', isPatron: false }));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.hasAccess).toBe(false);
            expect(result.data.reason).toBe('NOT_FOUND');
        }
    });
  });
});
