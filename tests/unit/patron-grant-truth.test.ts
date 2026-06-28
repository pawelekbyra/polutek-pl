import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { MainChannelService } from '@/lib/modules/channel';
import { getPatronStatus } from '@/lib/modules/patron';
import { AccessTier, VideoStatus } from '@prisma/client';
import { ok } from '@/lib/modules/shared/result';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

vi.mock('@/lib/modules/patron', () => ({
  getPatronStatus: vi.fn(),
}));

describe('PatronGrant Source of Truth Guard', () => {
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

  const patronVideo = {
    id: 'v1',
    creatorId: mainChannel.id,
    status: VideoStatus.PUBLISHED,
    tier: AccessTier.PATRON,
    publishedAt: new Date(now.getTime() - 1000),
    creator: { id: mainChannel.id, isApproved: true, isPrimary: true }
  };

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma, now: () => now });

  it('denies access if User.isPatron is true but PatronGrant is missing (Cache-only protection)', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    // User object has isPatron: true (the cache field)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false });

    // BUT getPatronStatus (which checks PatronGrant table) returns no active grants
    (getPatronStatus as any).mockResolvedValue(ok({ activeGrants: [] }));

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasAccess).toBe(false);
      expect(result.data.reason).toBe('PATRON_REQUIRED');
    }
  });

  it('allows access if User.isPatron is false but PatronGrant is active (Self-healing truth)', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    // User object has isPatron: false (the cache field is stale/wrong)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false });

    // BUT getPatronStatus finds an active grant
    (getPatronStatus as any).mockResolvedValue(ok({ activeGrants: [{ id: 'grant-1' }] }));

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasAccess).toBe(true);
    }
  });
});
