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

describe('checkVideoAccess Use Case', () => {
  let mockPrisma: any;
  const mainChannel = { id: 'main-channel-id' };

  beforeEach(() => {
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
    publishedAt: new Date(Date.now() - 1000),
    creator: { id: mainChannel.id, isApproved: true, isPrimary: true }
  };

  it('allows guest to see public published video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(baseVideo);

    const ctx = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(true);
    }
  });

  it('denies guest for logged_in video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, tier: AccessTier.LOGGED_IN });

    const ctx = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('LOGIN_REQUIRED');
    }
  });

  it('allows logged-in user for logged_in video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, tier: AccessTier.LOGGED_IN });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false });

    const ctx = createAppContext({ actor: { type: 'user', userId: 'u1', isPatron: false }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(true);
    }
  });

  it('denies non-patron for patron video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, tier: AccessTier.PATRON });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false, isPatron: false });

    const ctx = createAppContext({ actor: { type: 'user', userId: 'u1', isPatron: false }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('PATRON_REQUIRED');
    }
  });

  it('allows patron for patron video based on DB state', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, tier: AccessTier.PATRON });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false, isPatron: true });

    const ctx = createAppContext({ actor: { type: 'user', userId: 'u1', isPatron: false }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(true);
    }
  });

  it('allows admin to see draft video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, status: VideoStatus.DRAFT });

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(true);
    }
  });

  it('denies non-admin for draft video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, status: VideoStatus.DRAFT });

    const ctx = createAppContext({ actor: { type: 'user', userId: 'u1', isPatron: false }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
    }
  });

  it('denies access for archived video even for admin', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, status: VideoStatus.ARCHIVED });

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('NOT_FOUND');
    }
  });

  it('denies access for deleted user', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...baseVideo, tier: AccessTier.LOGGED_IN });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: true });

    const ctx = createAppContext({ actor: { type: 'user', userId: 'u1', isPatron: false }, prisma: mockPrisma });
    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, ctx);

    if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe('DELETED');
    }
  });
});
