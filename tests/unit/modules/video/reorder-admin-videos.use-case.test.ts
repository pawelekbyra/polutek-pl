import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reorderAdminVideos } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('reorderAdminVideos use-case', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };
  const mockPrisma = {
    video: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
  });

  it('rejects entire batch if any video is outside main channel', async () => {
    // Mocking findUnique to fail on the second video
    mockPrisma.video.findUnique
        .mockResolvedValueOnce({ id: 'v1', creatorId: 'c1', status: 'PUBLISHED' })
        .mockResolvedValueOnce({ id: 'v2', creatorId: 'other', status: 'PUBLISHED' });

    const result = await reorderAdminVideos([
        { id: 'v1', sidebarOrder: 1, showInSidebar: true },
        { id: 'v2', sidebarOrder: 2, showInSidebar: true }
    ], ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('VIDEO_NOT_ON_MAIN_CHANNEL');
    }
    // Only one update might have been called before error, or none if repository checks first.
    // In current implementation, it throws inside the loop in Repository.
    // However, the UseCase catches and fails.
  });

  it('succeeds for all valid main-channel videos', async () => {
    mockPrisma.video.findUnique.mockResolvedValue({ id: 'v1', creatorId: 'c1', status: 'PUBLISHED' });

    const result = await reorderAdminVideos([
        { id: 'v1', sidebarOrder: 1, showInSidebar: true }
    ], ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.updateMany).toHaveBeenCalled();
  });
});
