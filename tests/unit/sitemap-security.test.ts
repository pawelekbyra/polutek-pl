import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoContentService } from '@/lib/services/content/video.service';
import { prisma } from '@/lib/prisma';
import { AccessTier, VideoStatus } from '@prisma/client';
import { MainChannelService } from '@/lib/channel/main-channel.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    video: {
      findMany: vi.fn(),
    },
    user: {
        findFirst: vi.fn(),
    }
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
    vi.mocked(MainChannelService.getOptional).mockResolvedValue({ id: 'main-id', slug: 'main' } as any);
  });

  it('getSitemapVideos should only return PUBLIC videos', async () => {
    const mockVideos = [
      { id: 'v1', tier: AccessTier.PUBLIC, status: VideoStatus.PUBLISHED, creatorId: 'main-id' },
      { id: 'v2', tier: AccessTier.LOGGED_IN, status: VideoStatus.PUBLISHED, creatorId: 'main-id' },
      { id: 'v3', tier: AccessTier.PATRON, status: VideoStatus.PUBLISHED, creatorId: 'main-id' },
    ];

    const mockFindMany = vi.fn().mockImplementation(async (args: any) => {
      const tier = args?.where?.tier;
      if (tier === AccessTier.PUBLIC) {
        return mockVideos.filter(v => v.tier === AccessTier.PUBLIC) as any;
      }
      return mockVideos as any;
    });

    (prisma.video.findMany as any) = mockFindMany;

    const videos = await VideoContentService.getSitemapVideos();

    expect(videos).toHaveLength(1);
    expect(videos[0].id).toBe('v1');
    expect(videos[0].tier).toBe(AccessTier.PUBLIC);

    expect(mockFindMany).toHaveBeenCalled();
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs?.where?.tier).toBe(AccessTier.PUBLIC);
  });

  it('getSitemapVideos should return empty if prisma fails', async () => {
    (prisma.video.findMany as any) = vi.fn().mockRejectedValue(new Error('DB Error'));
    const videos = await VideoContentService.getSitemapVideos();
    expect(videos).toEqual([]);
  });
});
