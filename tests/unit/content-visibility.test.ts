import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessTier, VideoStatus } from '@prisma/client';
import { buildPublicVideoWhere } from '@/lib/modules/video/infrastructure/video-content.service';
import { MainChannelService } from '@/lib/channel/main-channel.service';

vi.mock('@/lib/channel/main-channel.service', () => ({
  MainChannelService: {
    getOptional: vi.fn(),
  },
}));

type TestVideo = {
  creatorId: string;
  status: VideoStatus;
  tier: AccessTier;
  publishedAt: Date | null;
  creator: { isApproved: boolean; isPrimary: boolean };
};

async function matchesPublicVideoWhere(video: TestVideo, now: Date) {
  const where = await buildPublicVideoWhere(now);
  const publicationWindow = where.OR as Array<{ publishedAt: null | { lte: Date } }>;

  const creatorIdMatches = video.creatorId === where.creatorId;
  const statusMatches = video.status === where.status;
  const creatorMatches = video.creator.isApproved === (where.creator as any)?.isApproved &&
                         video.creator.isPrimary === (where.creator as any)?.isPrimary;

  const publishedAtMatches = publicationWindow.some((condition) => {
    if (condition.publishedAt === null) return video.publishedAt === null;
    return !!video.publishedAt && video.publishedAt <= (condition.publishedAt as any).lte;
  });

  return creatorIdMatches && statusMatches && creatorMatches && publishedAtMatches;
}

describe('public video visibility policy', () => {
  const now = new Date('2026-05-31T12:00:00.000Z');
  const mainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };

  beforeEach(() => {
    vi.mocked(MainChannelService.getOptional).mockResolvedValue(mainChannel as any);
  });

  it('shows PUBLISHED videos from main channel', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'c1',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { isApproved: true, isPrimary: true },
    }, now)).toBe(true);
  });

  it('hides videos NOT on main channel', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'other-c',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { isApproved: true, isPrimary: true },
    }, now)).toBe(false);
  });

  it('requires a primary creator flag for public home visibility', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'c1',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.LOGGED_IN,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { isApproved: true, isPrimary: false },
    }, now)).toBe(false);
  });

  it('hides DRAFT and ARCHIVED videos', async () => {
    for (const status of [VideoStatus.DRAFT, VideoStatus.ARCHIVED]) {
      expect(await matchesPublicVideoWhere({
        creatorId: 'c1',
        status,
        tier: AccessTier.PUBLIC,
        publishedAt: new Date('2026-05-30T12:00:00.000Z'),
        creator: { isApproved: true, isPrimary: true },
      }, now)).toBe(false);
    }
  });

  it('hides videos from non-approved creators', async () => {
    expect(await matchesPublicVideoWhere({
      creatorId: 'c1',
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { isApproved: false, isPrimary: true },
    }, now)).toBe(false);
  });
});
