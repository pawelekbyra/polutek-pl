import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import sitemap from '@/app/sitemap';
import { CreatorContentService } from '@/lib/modules/channel/infrastructure/creator-content.service';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';

// The sitemap is empty while the site is a beta (see site-stage tests); these tests cover the launched site.
vi.mock('@/lib/site-stage', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/site-stage')>()), SITE_IS_BETA: false }));

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
      expect.objectContaining({ url: 'https://test.local/pl/regulamin' }),
      expect.objectContaining({ url: 'https://test.local/en/terms' }),
      expect.objectContaining({ url: 'https://test.local/pl/channel/main' }),
      expect.objectContaining({ url: 'https://test.local/en/channel/main' }),
      expect.objectContaining({ url: 'https://test.local/pl?v=my-video' }),
      expect.objectContaining({ url: 'https://test.local/en?v=my-video' }),
    ]));
    expect(result.map((entry) => entry.url).join(' ')).not.toMatch(/sklep|\/shop/);
  });

  it('lists only language-explicit URLs, each with its hreflang pair and English as x-default', async () => {
    vi.mocked(CreatorContentService.getConfiguredOrDefaultCreator).mockResolvedValue(null as any);
    vi.mocked(VideoContentService.getSitemapVideos).mockResolvedValue([]);

    const result = await sitemap();

    for (const entry of result) {
      expect(entry.url).toMatch(/^https:\/\/test\.local\/(pl|en)(\/|\?|$)/);
    }
    const home = result.find((entry) => entry.url === 'https://test.local/pl');
    expect(home?.alternates?.languages).toEqual({
      pl: 'https://test.local/pl',
      en: 'https://test.local/en',
      'x-default': 'https://test.local/en',
    });
  });
});
