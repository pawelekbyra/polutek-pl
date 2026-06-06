import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreatorContentService = vi.hoisted(() => ({
  getCreatorBySlug: vi.fn(),
  getConfiguredOrDefaultCreator: vi.fn(),
}));

const mockVideoContentService = vi.hoisted(() => ({
  getAllVideos: vi.fn(),
}));

vi.mock('@/lib/services/content/creator.service', () => ({
  CreatorContentService: mockCreatorContentService,
}));

vi.mock('@/lib/services/content/video.service', () => ({
  VideoContentService: mockVideoContentService,
}));

// Also mock the facade to avoid static initializer errors
vi.mock('@/lib/services/content.service', () => ({
  CreatorContentService: mockCreatorContentService,
  VideoContentService: mockVideoContentService,
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
    mockVideoContentService.getAllVideos.mockResolvedValue([]);
    mockCreatorContentService.getCreatorBySlug.mockResolvedValue({
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
    mockCreatorContentService.getCreatorBySlug.mockResolvedValue({
      slug: 'main-channel',
      videos: [mainCreatorVideo],
    });
    mockVideoContentService.getAllVideos.mockResolvedValue([otherCreatorVideo]);
    const sitemap = await importSitemap({ multiCreator: false });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com/?v=main-video');
    expect(mockCreatorContentService.getCreatorBySlug).toHaveBeenCalledWith('main-channel');
    expect(mockVideoContentService.getAllVideos).not.toHaveBeenCalled();
  });

  it('does not expose other creators videos in single-creator mode', async () => {
    mockCreatorContentService.getCreatorBySlug.mockResolvedValue({
      slug: 'main-channel',
      videos: [mainCreatorVideo],
    });
    mockVideoContentService.getAllVideos.mockResolvedValue([otherCreatorVideo]);
    const sitemap = await importSitemap({ multiCreator: false });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.includes('other-video'))).toBe(false);
    expect(urls.some((url) => url.includes('film-innego-tworcy'))).toBe(false);
    expect(mockVideoContentService.getAllVideos).not.toHaveBeenCalled();
  });

  it('continues to use all videos in multi-creator mode', async () => {
    mockVideoContentService.getAllVideos.mockResolvedValue([otherCreatorVideo]);
    const sitemap = await importSitemap({ multiCreator: true });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://example.com/channel/main-channel');
    expect(urls).toContain('https://example.com/?v=other-video');
    expect(mockVideoContentService.getAllVideos).toHaveBeenCalled();
    expect(mockCreatorContentService.getCreatorBySlug).toHaveBeenCalledWith('main-channel');
  });
});
