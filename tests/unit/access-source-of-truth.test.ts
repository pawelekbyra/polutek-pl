import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';
import { prisma as mockPrisma } from '@/lib/prisma';
import { AccessTier, VideoStatus } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    patronGrant: {
      findMany: vi.fn(),
    },
    creator: {
        findUnique: vi.fn(),
    },
    paymentTotal: {
        findMany: vi.fn(),
    }
  },
}));

vi.mock('@/lib/auth/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
}));

describe('Access Source of Truth (#1036)', () => {
  const mainChannelId = 'main-channel-id';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockPrisma.creator.findUnique).mockResolvedValue({
        id: mainChannelId,
        slug: 'main',
        status: 'ACTIVE',
        deletedAt: null,
    } as any);
  });

  it('VideoContentService.getVideoAccess grants a signed-in user with a PatronGrant too', async () => {
    const videoId = 'patron-video-id';
    const userId = 'user-1';

    // Mock video: PATRON tier
    vi.mocked(mockPrisma.video.findFirst).mockResolvedValue({
      id: videoId,
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creatorId: mainChannelId,
      creator: { status: 'ACTIVE' }
    } as any);

    // Mock user: cache says isPatron=false
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
      id: userId,
      isPatron: false,
      isDeleted: false,
      role: 'USER',
      paymentTotals: [] // Important for getPatronStatus -> normalizePaymentTotals
    } as any);

    // Mock active grant: truth says YES
    vi.mocked(mockPrisma.patronGrant.findMany).mockResolvedValue([{
      id: 'grant-1',
      status: 'ACTIVE',
      createdAt: new Date(),
      source: 'STRIPE'
    }] as any);

    const result = await VideoContentService.getVideoAccess(userId, videoId);

    expect(result.hasAccess).toBe(true);
  });

  it('VideoContentService.getVideoAccess grants a signed-in user without any PatronGrant', async () => {
    // Support grants nothing (CLAUDE.md §4.4): sign-in alone opens PATRON-tier videos.
    vi.mocked(mockPrisma.video.findFirst).mockResolvedValue({
      id: 'patron-video-id',
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creatorId: mainChannelId,
      creator: { status: 'ACTIVE' }
    } as any);
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      isDeleted: false,
      role: 'USER',
      paymentTotals: []
    } as any);
    vi.mocked(mockPrisma.patronGrant.findMany).mockResolvedValue([]);

    const result = await VideoContentService.getVideoAccess('user-1', 'patron-video-id');

    expect(result.hasAccess).toBe(true);
    expect(mockPrisma.patronGrant.findMany).not.toHaveBeenCalled();
  });

  it('VideoContentService.getVideoAccess treats null userId as guest', async () => {
    const videoId = 'patron-video-id';

    vi.mocked(mockPrisma.video.findFirst).mockResolvedValue({
      id: videoId,
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creatorId: mainChannelId,
      creator: { status: 'ACTIVE' }
    } as any);

    const result = await VideoContentService.getVideoAccess(null, videoId);

    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBe('LOGIN_REQUIRED');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('VideoContentService.getVideoAccess respects explicit userId and does not use ambient session', async () => {
     const videoId = 'public-video-id';
     const userId = 'user-1';

     vi.mocked(mockPrisma.video.findFirst).mockResolvedValue({
       id: videoId,
       tier: AccessTier.PUBLIC,
       status: VideoStatus.PUBLISHED,
       creatorId: mainChannelId,
       creator: { status: 'ACTIVE' }
     } as any);

     vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
       id: userId,
       isDeleted: false,
       role: 'USER',
       paymentTotals: []
     } as any);

     // Mock getPatronStatus internals to avoid crash
     vi.mocked(mockPrisma.patronGrant.findMany).mockResolvedValue([]);

     const result = await VideoContentService.getVideoAccess(userId, videoId);
     expect(result.hasAccess).toBe(true);
     expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
         where: { id: userId }
     }));
  });
});
