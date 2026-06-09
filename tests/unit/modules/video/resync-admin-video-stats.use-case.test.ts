import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resyncAdminVideoStats } from '@/lib/modules/video/application/resync-admin-video-stats.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { VideoNotFoundError, VideoNotOnMainChannelError } from '@/lib/modules/video/domain/video.errors';
import { MainChannelService } from '@/lib/modules/channel';
import { recordAuditEvent } from '@/lib/modules/audit';

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn(),
  },
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('resyncAdminVideoStats Use Case', () => {
  let mockPrisma: any;
  const mainChannel = { id: 'main-channel-id' };

  beforeEach(() => {
    mockPrisma = {
      video: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      videoLike: { count: vi.fn() },
      videoDislike: { count: vi.fn() },
      videoView: { count: vi.fn() },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };
    (MainChannelService.getRequired as any).mockResolvedValue(mainChannel);
  });

  it('resyncs stats for main-channel video', async () => {
    mockPrisma.video.findUnique.mockResolvedValue({ id: 'v1', creatorId: mainChannel.id });
    mockPrisma.videoLike.count.mockResolvedValue(10);
    mockPrisma.videoDislike.count.mockResolvedValue(2);
    mockPrisma.videoView.count.mockResolvedValue(100);
    mockPrisma.video.updateMany.mockResolvedValue({ count: 1 });

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await resyncAdminVideoStats({ videoId: 'v1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.likesCount).toBe(10);
      expect(result.data.dislikesCount).toBe(2);
      expect(result.data.views).toBe(100);
    }
    expect(recordAuditEvent).toHaveBeenCalled();
  });

  it('fails for off-channel video', async () => {
    mockPrisma.video.findUnique.mockResolvedValue({ id: 'v1', creatorId: 'other-channel' });

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await resyncAdminVideoStats({ videoId: 'v1' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error).toBeInstanceOf(VideoNotOnMainChannelError);
    }
  });
});
