import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessTier, VideoStatus } from '@prisma/client';
import { buildPublicVideoWhere } from '@/lib/modules/video/infrastructure/video-content.service';
import { MainChannelService } from '@/lib/modules/channel';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getOptional: vi.fn(),
  },
  publiclyVisibleChannelWhere: () => ({ status: { in: ['ACTIVE', 'LIMITED'] }, deletedAt: null }),
}));

type TestVideo = {
  creatorId: string;
  status: VideoStatus;
  tier: AccessTier;
  publishedAt: Date | null;
  creator: { status: string; deletedAt?: Date | null };
};

async function matchesPublicVideoWhere(video: TestVideo, now: Date) {
  const where = await buildPublicVideoWhere(now);
  const publicationWindow = where.OR as Array<{ publishedAt: null | { lte: Date } }>;

  const creatorIdMatches = video.creatorId === where.creatorId;
  const statusMatches = video.status === where.status;
  const visible = (where.creator as any)?.status?.in as string[];
  const creatorMatches = visible.includes(video.creator.status) && !video.creator.deletedAt === ((where.creator as any)?.deletedAt === null);

  const publishedAtMatches = publicationWindow.some((condition) => {
    if (condition.publishedAt === null) return video.publishedAt === null;
    return !!video.publishedAt && video.publishedAt <= (condition.publishedAt as any).lte;
  });

  return creatorIdMatches && statusMatches && creatorMatches && publishedAtMatches;
}

describe('public video visibility policy', () => {
  const now = new Date('2026-05-31T12:00:00.000Z');
  const mainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };

  beforeEach(() => {
    vi.mocked(MainChannelService.getOptional).mockResolvedValue(mainChannel as any);
  });

  it('shows PUBLISHED videos from main channel', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'c1',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { status: 'ACTIVE' },
    }, now)).toBe(true);
  });

  it('hides videos NOT on main channel', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'other-c',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { status: 'ACTIVE' },
    }, now)).toBe(false);
  });

  it('hides videos of a channel waiting for review', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'c1',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { status: 'PENDING_REVIEW' },
    }, now)).toBe(false);
  });

  it('hides DRAFT and ARCHIVED videos', async () => {
    for (const status of [VideoStatus.DRAFT, VideoStatus.ARCHIVED]) {
      expect(await matchesPublicVideoWhere({
        creatorId: 'c1',
        status,
        tier: AccessTier.PUBLIC,
        publishedAt: new Date('2026-05-30T12:00:00.000Z'),
        creator: { status: 'ACTIVE' },
      }, now)).toBe(false);
    }
  });

  it('hides videos of channels that are not publicly visible (PENDING_REVIEW, SUSPENDED, ...)', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'c1',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { status: 'SUSPENDED' },
    }, now)).toBe(false);
  });
});
