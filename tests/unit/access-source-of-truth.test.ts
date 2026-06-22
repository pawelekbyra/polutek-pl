import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: 'main-channel' }),
  },
}));

vi.mock('@/lib/modules/patron', () => ({
  getPatronStatus: vi.fn(),
}));

vi.mock('@/lib/feature-flags', () => ({
  canUseDemoFallbacks: vi.fn().mockReturnValue(false),
}));

import { prisma } from '@/lib/prisma';
const mockPrisma = prisma as any;

import { createAppContext } from '@/lib/modules/shared/app-context';

function createCtx(actor: any): AppContext {
  return createAppContext({
    actor,
    prisma: mockPrisma as any,
  });
}

describe('Access Source of Truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.video.findFirst.mockResolvedValue({
      id: 'v1',
      creatorId: 'main-channel',
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      publishedAt: null,
      creator: { id: 'main-channel', isApproved: true, isPrimary: true },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isDeleted: false,
      isPatron: false, // Legacy field
    });
  });

  it('grants access if PatronGrant is active even if User.isPatron is false', async () => {
    const { getPatronStatus } = await import('@/lib/modules/patron');
    vi.mocked(getPatronStatus).mockResolvedValue({
      ok: true,
      data: { activeGrants: [{ id: 'grant-1' }] } as any,
    });

    const result = await checkVideoAccess(
      { videoIdOrSlug: 'v1' },
      createCtx({ type: 'user', userId: 'u1' })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasAccess).toBe(true);
    }
  });

  it('denies access if no PatronGrant exists even if User.isPatron is true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isDeleted: false,
      isPatron: true, // Legacy field is true
    });

    const { getPatronStatus } = await import('@/lib/modules/patron');
    vi.mocked(getPatronStatus).mockResolvedValue({
      ok: true,
      data: { activeGrants: [] } as any,
    });

    const result = await checkVideoAccess(
      { videoIdOrSlug: 'v1' },
      createCtx({ type: 'user', userId: 'u1' })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasAccess).toBe(false);
      expect(result.data.reason).toBe('PATRON_REQUIRED');
    }
  });

  it('does not grant access to guest even with PATRON tier video', async () => {
    const result = await checkVideoAccess(
      { videoIdOrSlug: 'v1' },
      createCtx({ type: 'guest' })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasAccess).toBe(false);
      expect(result.data.reason).toBe('PATRON_REQUIRED');
    }
  });
});

describe('VideoContentService Bridge access truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.video.findFirst.mockResolvedValue({
      id: 'patron-v1',
      creatorId: 'main-channel',
      tier: AccessTier.PATRON,
      status: VideoStatus.PUBLISHED,
      publishedAt: null,
      creator: { id: 'main-channel', isApproved: true, isPrimary: true },
    });
  });

  it('respects explicit userId and uses PatronGrant status', async () => {
    const { VideoContentService } = await import('@/lib/services/content/video.service');
    const { getPatronStatus } = await import('@/lib/modules/patron');

    // Case 1: Active grant, User.isPatron=false
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u-explicit',
      isDeleted: false,
      isPatron: false,
    });
    vi.mocked(getPatronStatus).mockResolvedValue({
      ok: true,
      data: { activeGrants: [{ id: 'g1' }] } as any,
    });

    const result1 = await VideoContentService.getVideoAccess('u-explicit', 'patron-v1');
    expect(result1.hasAccess).toBe(true);

    // Case 2: No grant, User.isPatron=true (stale cache)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u-stale',
      isDeleted: false,
      isPatron: true,
    });
    vi.mocked(getPatronStatus).mockResolvedValue({
      ok: true,
      data: { activeGrants: [] } as any,
    });

    const result2 = await VideoContentService.getVideoAccess('u-stale', 'patron-v1');
    expect(result2.hasAccess).toBe(false);
    expect(result2.reason).toBe('PATRON_REQUIRED');
  });

  it('behaves as guest when userId is null and does not call getActorFromAuth', async () => {
    const { VideoContentService } = await import('@/lib/services/content/video.service');
    const auth = await import('@/lib/api/auth');
    const spy = vi.spyOn(auth, 'getActorFromAuth');

    const result = await VideoContentService.getVideoAccess(null, 'patron-v1');
    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBe('PATRON_REQUIRED');
    expect(spy).not.toHaveBeenCalled();
  });
});
