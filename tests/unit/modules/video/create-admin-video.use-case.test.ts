import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AccessTier, VideoStatus } from '@prisma/client';

describe('createAdminVideo use-case', () => {
  const mockMainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };
  const mockPrisma = {
    video: {
      create: vi.fn(),
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

  it('fails with MainChannelNotFoundError if no main channel', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(null);
    await expect(createAdminVideo({
        title: 'T', slug: 's', videoUrl: 'https://youtube.com/watch?v=123', thumbnailUrl: 't', tier: 'PUBLIC', status: 'PUBLISHED'
    }, ctx)).rejects.toThrow('not found in database');
  });

  it('creates video with mainChannel.id as creatorId', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(mockMainChannel);
    mockPrisma.video.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'v1' }));

    const result = await createAdminVideo({
        title: 'T', slug: 's', videoUrl: 'https://youtube.com/watch?v=123', thumbnailUrl: 't', tier: 'PUBLIC', status: 'PUBLISHED'
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ creatorId: 'c1' })
    }));
  });
});
