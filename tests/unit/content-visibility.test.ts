import { describe, expect, it } from 'vitest';
import { AccessTier, VideoStatus } from '@prisma/client';
import { buildPublicVideoWhere } from '@/lib/services/content.service';
import { calculateChargebackNetAdjustment } from '@/lib/services/payment.service';

type TestVideo = {
  status: VideoStatus;
  tier: AccessTier;
  publishedAt: Date | null;
  creator: { isApproved: boolean; isPrimary: boolean };
};

function matchesPublicVideoWhere(video: TestVideo, now: Date) {
  const where = buildPublicVideoWhere(now);
  const publicationWindow = where.OR as Array<{ publishedAt: null | { lte: Date } }>;

  const statusMatches = video.status === where.status;
  const creatorMatches = video.creator.isApproved === where.creator?.isApproved;
  const publishedAtMatches = publicationWindow.some((condition) => {
    if (condition.publishedAt === null) return video.publishedAt === null;
    return !!video.publishedAt && video.publishedAt <= condition.publishedAt.lte;
  });

  return statusMatches && creatorMatches && publishedAtMatches;
}

describe('public video visibility policy', () => {
  const now = new Date('2026-05-31T12:00:00.000Z');

  it('shows PUBLISHED videos from approved creators', () => {
    expect(matchesPublicVideoWhere({
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { isApproved: true, isPrimary: false },
    }, now)).toBe(true);
  });

  it('does not require a primary creator flag for public home visibility', () => {
    expect(matchesPublicVideoWhere({
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.LOGGED_IN,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { isApproved: true, isPrimary: false },
    }, now)).toBe(true);
  });

  it('hides DRAFT and ARCHIVED videos', () => {
    for (const status of [VideoStatus.DRAFT, VideoStatus.ARCHIVED]) {
      expect(matchesPublicVideoWhere({
        status,
        tier: AccessTier.PUBLIC,
        publishedAt: new Date('2026-05-30T12:00:00.000Z'),
        creator: { isApproved: true, isPrimary: true },
      }, now)).toBe(false);
    }
  });

  it('hides videos from non-approved creators', () => {
    expect(matchesPublicVideoWhere({
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-05-30T12:00:00.000Z'),
      creator: { isApproved: false, isPrimary: true },
    }, now)).toBe(false);
  });

  it('keeps legacy PUBLISHED videos with null publishedAt visible', () => {
    expect(matchesPublicVideoWhere({
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: null,
      creator: { isApproved: true, isPrimary: true },
    }, now)).toBe(true);
  });

  it('does not show scheduled future PUBLISHED videos', () => {
    expect(matchesPublicVideoWhere({
      status: VideoStatus.PUBLISHED,
      tier: AccessTier.PUBLIC,
      publishedAt: new Date('2026-06-01T12:00:00.000Z'),
      creator: { isApproved: true, isPrimary: true },
    }, now)).toBe(false);
  });
});

describe('chargeback net totals adjustment', () => {
  it('subtracts only the remaining net amount after a partial refund', () => {
    expect(calculateChargebackNetAdjustment({ amountMinor: 2000, refundedAmountMinor: 500 })).toBe(1500);
  });
});
