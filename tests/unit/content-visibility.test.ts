import { describe, expect, it } from 'vitest';
import { VideoStatus } from '@prisma/client';
import { buildMainFeaturedVideoWhere, buildVisibleVideoWhere } from '@/lib/services/content.service';

describe('public video visibility query', () => {
  const now = new Date('2026-05-31T12:00:00Z');

  it('shows only published videos from approved creators', () => {
    expect(buildVisibleVideoWhere(now)).toMatchObject({
      status: VideoStatus.PUBLISHED,
      creator: { isApproved: true },
    });
  });

  it('does not require a primary creator, so lack of primary does not hide all videos', () => {
    const where = buildVisibleVideoWhere(now);
    expect(where.creator).toEqual({ isApproved: true });
  });

  it('keeps draft and archived videos out by requiring PUBLISHED', () => {
    const where = buildVisibleVideoWhere(now);
    expect(where.status).toBe(VideoStatus.PUBLISHED);
    expect(where.status).not.toBe(VideoStatus.DRAFT);
    expect(where.status).not.toBe(VideoStatus.ARCHIVED);
  });

  it('treats legacy PUBLISHED videos with null publishedAt as visible', () => {
    expect(buildVisibleVideoWhere(now)).toMatchObject({
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: now } },
      ],
    });
  });

  it('adds isMainFeatured only for the main featured lookup', () => {
    expect(buildMainFeaturedVideoWhere(now)).toMatchObject({
      ...buildVisibleVideoWhere(now),
      isMainFeatured: true,
    });
  });
});
