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

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
}));

describe('Access Source of Truth (#1036)', () => {
  const mainChannelId = 'main-channel-id';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockPrisma.creator.findUnique).mockResolvedValue({
        id: mainChannelId,
        slug: 'main',
        isApproved: true,
        isPrimary: true,
    } as any);
  });

  it('VideoContentService.getVideoAccess respects active PatronGrant regardless of User.isPatron cache', async () => {
    const videoId = 'patron-video-id';
    const userId = 'user-1';

    // Mock video: PATRON tier
    vi.mocked(mockPrisma.video.findFirst).mockResolvedValue({
      id: videoId,
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creatorId: mainChannelId,
      creator: { isApproved: true, isPrimary: true }
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

  it('VideoContentService.getVideoAccess denies access if PatronGrant is missing even if User.isPatron cache is true', async () => {
    const videoId = 'patron-video-id';
    const userId = 'user-1';

    // Mock video: PATRON tier
    vi.mocked(mockPrisma.video.findFirst).mockResolvedValue({
      id: videoId,
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creatorId: mainChannelId,
      creator: { isApproved: true, isPrimary: true }
    } as any);

    // Mock user: cache says isPatron=true
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
      id: userId,
      isPatron: true,
      isDeleted: false,
      role: 'USER',
      paymentTotals: []
    } as any);

    // Mock no grants: truth says NO
    vi.mocked(mockPrisma.patronGrant.findMany).mockResolvedValue([]);

    const result = await VideoContentService.getVideoAccess(userId, videoId);

    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBe('PATRON_REQUIRED');
  });

  it('VideoContentService.getVideoAccess treats null userId as guest', async () => {
    const videoId = 'patron-video-id';

    vi.mocked(mockPrisma.video.findFirst).mockResolvedValue({
      id: videoId,
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      creatorId: mainChannelId,
      creator: { isApproved: true, isPrimary: true }
    } as any);

    const result = await VideoContentService.getVideoAccess(null, videoId);

    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBe('PATRON_REQUIRED');
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
       creator: { isApproved: true, isPrimary: true }
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
