import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';
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
    (MainChannelService.getOptional as any).mockResolvedValue({ id: 'main-channel-id' });
  });

  it('enforces PUBLIC tier for sitemap videos', async () => {
    const mockFindMany = vi.mocked(prisma.video.findMany);
    mockFindMany.mockResolvedValue([]);

    await VideoContentService.getSitemapVideos();

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tier: 'PUBLIC',
        status: 'PUBLISHED',
        creatorId: 'main-channel-id',
        creator: {
          isApproved: true,
          isPrimary: true,
        },
      }),
    }));
  });

  it('excludes non-PUBLIC videos from sitemap', async () => {
    const mockFindMany = vi.mocked(prisma.video.findMany);

    // Even if DB returned them (it shouldn't because of the where clause), we verify the query filter
    await VideoContentService.getSitemapVideos();

    const whereClause = mockFindMany.mock.calls[0][0]?.where;
    expect(whereClause?.tier).toBe('PUBLIC');
    expect(whereClause?.tier).not.toBe('PATRON');
    expect(whereClause?.tier).not.toBe('LOGGED_IN');
  });

  it('enforces PUBLISHED status and visibility filters', async () => {
    const mockFindMany = vi.mocked(prisma.video.findMany);
    await VideoContentService.getSitemapVideos();

    const whereClause = mockFindMany.mock.calls[0][0]?.where;
    expect(whereClause?.status).toBe('PUBLISHED');
    expect(whereClause).toHaveProperty('OR');
    // @ts-ignore
    expect(whereClause?.OR).toContainEqual({ publishedAt: null });
    // @ts-ignore
    expect(whereClause?.OR).toContainEqual(expect.objectContaining({ publishedAt: { lte: expect.any(Date) } }));
  });

  it('only includes videos from the main channel', async () => {
    const mockFindMany = vi.mocked(prisma.video.findMany);
    await VideoContentService.getSitemapVideos();

    const whereClause = mockFindMany.mock.calls[0][0]?.where;
    expect(whereClause?.creatorId).toBe('main-channel-id');
  });
});
