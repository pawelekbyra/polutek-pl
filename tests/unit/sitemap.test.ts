import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockContentService = vi.hoisted(() => ({
  getAllVideos: vi.fn(),
  getCreatorBySlug: vi.fn(),
}));

vi.mock('@/lib/services/content.service', () => ({
  ContentService: mockContentService,
}));

const mainCreatorVideo = {
  id: 'main-video',
  slug: 'film-glownego-tworcy',
  title: 'Film głównego twórcy',
  tier: 'PUBLIC',
  publishedAt: new Date('2026-01-01'),
};

const otherCreatorVideo = {
  id: 'other-video',
  slug: 'film-innego-tworcy',
  title: 'Film innego twórcy',
  tier: 'PUBLIC',
  publishedAt: new Date('2026-01-01'),
};

async function importSitemap({ multiCreator }: { multiCreator: boolean }) {
  process.env.ENABLE_MULTI_CREATOR = multiCreator ? 'true' : 'false';
  process.env.MAIN_CREATOR_SLUG = 'main-channel';

  const { default: sitemap } = await import('@/app/sitemap');

  return sitemap;
}

describe('sitemap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    process.env.ENABLE_MULTI_CREATOR = 'false';
    process.env.MAIN_CREATOR_SLUG = 'main-channel';
    mockContentService.getAllVideos.mockResolvedValue([]);
    mockContentService.getCreatorBySlug.mockResolvedValue({
      slug: 'main-channel',
      videos: [],
    });
  });

  it('includes the main creator channel in single-creator mode', async () => {
    const sitemap = await importSitemap({ multiCreator: false });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://example.com/channel/main-channel');
  });

  it('fetches only the main creator videos in single-creator mode', async () => {
    mockContentService.getCreatorBySlug.mockResolvedValue({
      slug: 'main-channel',
      videos: [mainCreatorVideo],
    });
    mockContentService.getAllVideos.mockResolvedValue([otherCreatorVideo]);
    const sitemap = await importSitemap({ multiCreator: false });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com/?v=main-video');
    expect(mockContentService.getCreatorBySlug).toHaveBeenCalledWith('main-channel');
    expect(mockContentService.getAllVideos).not.toHaveBeenCalled();
  });

  it('does not expose other creators videos in single-creator mode', async () => {
    mockContentService.getCreatorBySlug.mockResolvedValue({
      slug: 'main-channel',
      videos: [mainCreatorVideo],
    });
    mockContentService.getAllVideos.mockResolvedValue([otherCreatorVideo]);
    const sitemap = await importSitemap({ multiCreator: false });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.includes('other-video'))).toBe(false);
    expect(urls.some((url) => url.includes('film-innego-tworcy'))).toBe(false);
    expect(mockContentService.getAllVideos).not.toHaveBeenCalled();
  });

  it('continues to use all videos in multi-creator mode', async () => {
    mockContentService.getAllVideos.mockResolvedValue([otherCreatorVideo]);
    const sitemap = await importSitemap({ multiCreator: true });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://example.com/channel/main-channel');
    expect(urls).toContain('https://example.com/?v=other-video');
    expect(mockContentService.getAllVideos).toHaveBeenCalled();
    expect(mockContentService.getCreatorBySlug).toHaveBeenCalledWith('main-channel');
  });
});
