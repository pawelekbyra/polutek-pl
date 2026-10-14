import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('updateAdminVideo use-case', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };
  const mockPrisma = {
    video: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  } as any;

  const ctx = createAppContext({
    actor: { type: 'admin', userId: 'a1' },
    prisma: mockPrisma
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'polutek';
  });

  it('returns VIDEO_NOT_FOUND if video missing', async () => {
    mockPrisma.video.findUnique.mockResolvedValue(null);
    const result = await updateAdminVideo({ id: 'v1', title: 'New' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('VIDEO_NOT_FOUND');
    }
  });

  it('returns VIDEO_NOT_ON_MAIN_CHANNEL if creatorId mismatch', async () => {
    mockPrisma.video.findUnique.mockResolvedValue({ id: 'v1', creatorId: 'other' });
    const result = await updateAdminVideo({ id: 'v1', title: 'New' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('VIDEO_NOT_ON_MAIN_CHANNEL');
    }
  });

  it('returns VIDEO_INVALID_HERO if trying to hero a PATRON video', async () => {
    mockPrisma.video.findUnique.mockResolvedValue({ id: 'v1', creatorId: 'c1', tier: 'PUBLIC', status: 'PUBLISHED' });
    const result = await updateAdminVideo({ id: 'v1', isMainFeatured: true, tier: AccessTier.PATRON }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('VIDEO_INVALID_HERO');
    }
  });

  it('succeeds and records audit on valid update', async () => {
    const existing = { id: 'v1', creatorId: 'c1', title: 'Old', tier: 'PUBLIC', status: 'PUBLISHED' };
    mockPrisma.video.findUnique.mockResolvedValue(existing);
    mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.video.findFirst.mockResolvedValue({ ...existing, title: 'New' });

    const result = await updateAdminVideo({ id: 'v1', title: 'New' }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.updateMany).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'VIDEO_UPDATED' })
    }));
  });
});

describe('updateAdminVideo hero/sidebar contract', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };
  const mockPrisma = {
    video: { findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  } as any;
  const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma: mockPrisma });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'polutek';
  });

  it('allows hero only when public published video has READY own-HLS asset', async () => {
    const existing = {
      id: 'v1', creatorId: 'c1', title: 'Hero', slug: 'hero', tier: AccessTier.PUBLIC, status: VideoStatus.PUBLISHED,
      asset: { isPrimary: true, provider: 'SELF_HLS', processingState: 'READY', objectKey: 'videos/v1/v/v1' },
      activePlaybackRoute: { asset: { provider: 'SELF_HLS', processingState: 'READY', objectKey: 'videos/v1/v/v1' } }
    };
    mockPrisma.video.findUnique.mockResolvedValue(existing);
    mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.video.findFirst.mockResolvedValue({ ...existing, isMainFeatured: true });

    const result = await updateAdminVideo({ id: 'v1', isMainFeatured: true }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { creatorId: 'c1', isMainFeatured: true, id: { not: 'v1' } },
      data: { isMainFeatured: false }
    }));
  });

  it('rejects sidebar visibility for drafts', async () => {
    mockPrisma.video.findUnique.mockResolvedValue({ id: 'v1', creatorId: 'c1', tier: AccessTier.PUBLIC, status: VideoStatus.DRAFT, asset: null });
    const result = await updateAdminVideo({ id: 'v1', showInSidebar: true }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_INVALID_SIDEBAR');
  });

  it('allows resaving an already-Hero video with a legacy missing active playback route (unrelated edit, e.g. title)', async () => {
    // Regression: a video that became Hero before the active-playback-route invariant
    // existed (or otherwise has a legacy gap there) still plays fine in production —
    // but the edit form always resubmits the current isMainFeatured=true on every save.
    // Re-validating hero eligibility on every save (not just on promotion) made such a
    // video permanently unsavable, even for a trivial title change.
    const existing = {
      id: 'v1', creatorId: 'c1', title: 'Old', slug: 'hero', tier: AccessTier.PUBLIC, status: VideoStatus.PUBLISHED,
      isMainFeatured: true,
      asset: { isPrimary: true, provider: 'SELF_HLS', processingState: 'READY', objectKey: 'videos/v1/v/v1' },
      activePlaybackRoute: null,
    };
    mockPrisma.video.findUnique.mockResolvedValue(existing);
    mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.video.findFirst.mockResolvedValue({ ...existing, title: 'New' });

    const result = await updateAdminVideo({ id: 'v1', title: 'New', isMainFeatured: true }, ctx);

    expect(result.ok).toBe(true);
  });
});
