import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { MainChannelService } from '@/lib/modules/channel';
import { getPatronStatus } from '@/lib/modules/patron';
import { AccessTier, VideoStatus } from '@prisma/client';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

vi.mock('@/lib/modules/patron', () => ({
  getPatronStatus: vi.fn(),
}));

// Since 2026-09-22 support grants nothing (CLAUDE.md §4.4): a PATRON-tier video needs
// sign-in only, and PatronGrant/cache fields must never influence the decision.
describe('PATRON tier needs sign-in only', () => {
  let mockPrisma: any;
  const mainChannel = { id: 'main-channel-id' };
  const now = new Date('2026-01-01T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      video: { findFirst: vi.fn() },
      user: { findUnique: vi.fn() },
    };
    (MainChannelService.getRequired as any).mockResolvedValue(mainChannel);
  });

  const patronVideo = {
    id: 'v1',
    creatorId: mainChannel.id,
    status: VideoStatus.PUBLISHED,
    tier: AccessTier.PATRON,
    publishedAt: new Date(now.getTime() - 1000),
    creator: { id: mainChannel.id, status: 'ACTIVE' },
  };

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma, now: () => now });

  it('grants a signed-in user without any PatronGrant, without reading grants', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: false });

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));

    expect(result.ok && result.data.hasAccess).toBe(true);
    expect(getPatronStatus).not.toHaveBeenCalled();
  });

  it('asks a guest to sign in, never to pay', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'guest' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasAccess).toBe(false);
      expect(result.data.reason).toBe('LOGIN_REQUIRED');
    }
  });

  it('still denies a soft-deleted user', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(patronVideo);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isDeleted: true });

    const result = await checkVideoAccess({ videoIdOrSlug: 'v1' }, createCtx({ type: 'user', userId: 'u1' }));

    expect(result.ok && result.data.hasAccess).toBe(false);
  });
});
