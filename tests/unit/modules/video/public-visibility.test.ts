import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isVideoPubliclyVisible } from '@/lib/modules/video/domain/public-visibility';

const hoisted = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: { findFirst: hoisted.findFirst },
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    // No main channel configured: the avatar fallback for the main channel is not in play here.
    appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    creator: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock('@/lib/modules/video/infrastructure/fundraising-progress.service', () => ({
  withFundraisingProgress: vi.fn(async (dtos: unknown[]) => dtos),
}));

import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';

const activeChannel = { id: 'c2', slug: 'inny', name: 'Inny', status: 'ACTIVE', deletedAt: null, user: { imageUrl: null, email: 'x@example.com' } };
const published = (over: Record<string, unknown> = {}) => ({
  id: 'v9',
  slug: 'film-z-innego-kanalu',
  creatorId: 'c2',
  title: 'Film',
  tier: 'PUBLIC',
  status: 'PUBLISHED',
  moderationStatus: 'VISIBLE',
  publishedAt: new Date('2026-01-01'),
  creator: activeChannel,
  ...over,
});

describe('isVideoPubliclyVisible', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('accepts a due, published video on an ACTIVE channel (also LIMITED)', () => {
    expect(isVideoPubliclyVisible(published(), now)).toBe(true);
    expect(isVideoPubliclyVisible(published({ creator: { ...activeChannel, status: 'LIMITED' } }), now)).toBe(true);
  });

  it.each(['DRAFT', 'ARCHIVED'])('rejects status %s', (status) => {
    expect(isVideoPubliclyVisible(published({ status }), now)).toBe(false);
  });

  it('accepts an UNLISTED video (reachable by link; the list queries filter it out themselves)', () => {
    expect(isVideoPubliclyVisible(published({ status: 'UNLISTED' }), now)).toBe(true);
  });

  it('still rejects an UNLISTED video that is removed, not due, or on a hidden channel', () => {
    expect(isVideoPubliclyVisible(published({ status: 'UNLISTED', moderationStatus: 'REMOVED' }), now)).toBe(false);
    expect(isVideoPubliclyVisible(published({ status: 'UNLISTED', publishedAt: new Date('2026-07-01') }), now)).toBe(false);
    expect(isVideoPubliclyVisible(published({ status: 'UNLISTED', creator: { ...activeChannel, status: 'SUSPENDED' } }), now)).toBe(false);
  });

  it('rejects a video removed by moderation', () => {
    expect(isVideoPubliclyVisible(published({ moderationStatus: 'REMOVED' }), now)).toBe(false);
  });

  it('rejects a video that is not due yet', () => {
    expect(isVideoPubliclyVisible(published({ publishedAt: new Date('2026-07-01') }), now)).toBe(false);
  });

  it.each([
    ['suspended', { status: 'SUSPENDED' }],
    ['banned', { status: 'BANNED' }],
    ['deleted', { deletedAt: new Date('2026-05-01') }],
    ['pending review', { status: 'PENDING_REVIEW' }],
  ])('rejects a %s channel', (_label, patch) => {
    expect(isVideoPubliclyVisible(published({ creator: { ...activeChannel, ...patch } }), now)).toBe(false);
  });

  it('ignores the legacy isApproved flag: status alone decides', () => {
    expect(isVideoPubliclyVisible(published({ creator: { ...activeChannel, isApproved: false } }), now)).toBe(true);
    expect(isVideoPubliclyVisible(published({ creator: { ...activeChannel, status: 'PENDING_REVIEW', isApproved: true } }), now)).toBe(false);
  });

  it('rejects a video without a channel', () => {
    expect(isVideoPubliclyVisible(published({ creator: null }), now)).toBe(false);
  });
});

describe('VideoContentService.getPublicVideoByIdOrSlug', () => {
  beforeEach(() => {
    hoisted.findFirst.mockReset();
  });

  it('returns the DTO of a published video of another channel, found by slug or id', async () => {
    hoisted.findFirst.mockResolvedValue(published());
    const dto = await VideoContentService.getPublicVideoByIdOrSlug('film-z-innego-kanalu');
    expect(dto).toMatchObject({ id: 'v9', slug: 'film-z-innego-kanalu', creatorId: 'c2' });
    expect(hoisted.findFirst.mock.calls[0][0].where).toEqual({ OR: [{ id: 'film-z-innego-kanalu' }, { slug: 'film-z-innego-kanalu' }] });
  });

  it('returns null for a missing video', async () => {
    hoisted.findFirst.mockResolvedValue(null);
    expect(await VideoContentService.getPublicVideoByIdOrSlug('nope')).toBeNull();
  });

  it('loads an UNLISTED video by slug or id (the link works), with the DTO carrying its status', async () => {
    hoisted.findFirst.mockResolvedValue(published({ status: 'UNLISTED' }));
    const dto = await VideoContentService.getPublicVideoByIdOrSlug('film-z-innego-kanalu');
    expect(dto).toMatchObject({ id: 'v9', status: 'UNLISTED' });
  });

  it('marks an adult video in the public DTO (declared or moderated)', async () => {
    hoisted.findFirst.mockResolvedValue(published({ isAdult: true }));
    expect(await VideoContentService.getPublicVideoByIdOrSlug('x')).toMatchObject({ isAdult: true });
    hoisted.findFirst.mockResolvedValue(published({ moderationStatus: 'AGE_RESTRICTED' }));
    expect(await VideoContentService.getPublicVideoByIdOrSlug('x')).toMatchObject({ isAdult: true });
    hoisted.findFirst.mockResolvedValue(published());
    expect(await VideoContentService.getPublicVideoByIdOrSlug('x')).toMatchObject({ isAdult: false });
  });

  it('returns null for a draft, an archived or a removed video and for a hidden channel', async () => {
    for (const row of [
      published({ status: 'DRAFT' }),
      published({ status: 'ARCHIVED' }),
      published({ moderationStatus: 'REMOVED' }),
      published({ creator: { ...activeChannel, status: 'SUSPENDED' } }),
    ]) {
      hoisted.findFirst.mockResolvedValue(row);
      expect(await VideoContentService.getPublicVideoByIdOrSlug('x')).toBeNull();
    }
  });

  it('returns null (not an error) when the database fails', async () => {
    hoisted.findFirst.mockRejectedValue(new Error('db down'));
    expect(await VideoContentService.getPublicVideoByIdOrSlug('x')).toBeNull();
  });

  it('does not query for an empty or oversized value', async () => {
    expect(await VideoContentService.getPublicVideoByIdOrSlug('  ')).toBeNull();
    expect(await VideoContentService.getPublicVideoByIdOrSlug('a'.repeat(201))).toBeNull();
    expect(hoisted.findFirst).not.toHaveBeenCalled();
  });
});
