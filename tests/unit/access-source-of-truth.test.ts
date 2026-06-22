import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';

// Mock dependencies
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

const mockPrisma = {
  video: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

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
