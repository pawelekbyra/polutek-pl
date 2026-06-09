import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoContentService } from '@/lib/services/content/video.service';
import { prisma } from '@/lib/prisma';
import { MainChannelService } from '@/lib/channel/main-channel.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/channel/main-channel.service', () => ({
  MainChannelService: {
    getOptional: vi.fn(),
  },
}));

describe('Sitemap Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (MainChannelService.getOptional as any).mockResolvedValue({ id: 'c1' });
  });

  it('enforces PUBLIC tier for sitemap videos', async () => {
    const mockFindMany = vi.mocked(prisma.video.findMany);
    mockFindMany.mockResolvedValue([]);

    await VideoContentService.getSitemapVideos();

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tier: 'PUBLIC',
        status: 'PUBLISHED',
      }),
    }));
  });
});
