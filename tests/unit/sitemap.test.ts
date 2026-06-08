import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import sitemap from '@/app/sitemap';
import { CreatorContentService, VideoContentService } from '@/lib/services/content.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creator: { findUnique: vi.fn(), findFirst: vi.fn() },
    video: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/services/content.service', () => ({
  CreatorContentService: {
    getCreatorBySlug: vi.fn(),
    getConfiguredOrDefaultCreator: vi.fn(),
  },
  VideoContentService: {
    getAllVideos: vi.fn(),
  },
}));

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.local';
  });

  it('generates basic routes and creator/video routes', async () => {
    vi.mocked(CreatorContentService.getConfiguredOrDefaultCreator).mockResolvedValue({ slug: 'main' } as any);
    vi.mocked(VideoContentService.getAllVideos).mockResolvedValue([{ id: 'v1', publishedAt: new Date() }] as any);

    const result = await sitemap();

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: 'https://test.local' }),
      expect.objectContaining({ url: 'https://test.local/channel/main' }),
      expect.objectContaining({ url: 'https://test.local/?v=v1' }),
    ]));
  });
});
