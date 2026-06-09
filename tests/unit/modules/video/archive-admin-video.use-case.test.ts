import { describe, it, expect, vi, beforeEach } from 'vitest';
import { archiveAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('archiveAdminVideo use-case', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };
  const mockPrisma = {
    video: {
      findUnique: vi.fn(),
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
    const result = await archiveAdminVideo('v1', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('VIDEO_NOT_FOUND');
    }
  });

  it('succeeds and records audit on valid archive', async () => {
    mockPrisma.video.findUnique.mockResolvedValue({ id: 'v1', creatorId: 'c1', status: 'PUBLISHED' });
    mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.video.findFirst.mockResolvedValue({ id: 'v1', status: 'ARCHIVED' });

    const result = await archiveAdminVideo('v1', ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'v1', creatorId: 'c1' },
        data: { status: 'ARCHIVED' }
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'VIDEO_ARCHIVED' })
    }));
  });
});
