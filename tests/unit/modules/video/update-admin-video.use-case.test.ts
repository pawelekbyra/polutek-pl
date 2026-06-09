import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('updateAdminVideo use-case', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };
  const mockPrisma = {
    video: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    creator: { findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
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
