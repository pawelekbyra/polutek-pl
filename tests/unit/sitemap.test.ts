import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import sitemap from '@/app/sitemap';
import { CreatorContentService } from '@/lib/modules/channel/infrastructure/creator-content.service';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creator: { findUnique: vi.fn(), findFirst: vi.fn() },
    video: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/modules/channel/infrastructure/creator-content.service', () => ({
  CreatorContentService: {
    getCreatorBySlug: vi.fn(),
    getConfiguredOrDefaultCreator: vi.fn(),
  },
}));

vi.mock('@/lib/modules/video/infrastructure/video-content.service', () => ({
  VideoContentService: {
    getAllVideos: vi.fn(),
    getSitemapVideos: vi.fn(),
  },
}));

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.local';
  });

  it('generates basic routes and creator/video routes', async () => {
    vi.mocked(CreatorContentService.getConfiguredOrDefaultCreator).mockResolvedValue({ slug: 'main' } as any);
    vi.mocked(VideoContentService.getSitemapVideos).mockResolvedValue([{ id: 'v1', slug: 'my-video', publishedAt: new Date() }] as any);

    const result = await sitemap();

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://test.local/pl' }),
      expect.objectContaining({ url: 'https://test.local/en' }),
      expect.objectContaining({ url: 'https://test.local/pl/channel/main' }),
      expect.objectContaining({ url: 'https://test.local/en/channel/main' }),
      expect.objectContaining({ url: 'https://test.local/pl/watch/my-video' }),
      expect.objectContaining({ url: 'https://test.local/en/watch/my-video' }),
      expect.objectContaining({ url: 'https://test.local/pl/sklep' }),
      expect.objectContaining({ url: 'https://test.local/en/shop' }),
    ]));
  });
});
