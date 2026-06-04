import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFeatureFlags = vi.hoisted(() => ({
  flags: {
    demoFallbacks: false,
    multiCreator: false,
    mainCreatorSlug: 'kraufanding',
  },
}));

vi.mock('@/lib/feature-flags', () => mockFeatureFlags);

vi.mock('@/lib/services/content.service', () => ({
  ContentService: {
    getAllVideos: vi.fn().mockResolvedValue([]),
  },
}));

describe('sitemap', () => {
  beforeEach(() => {
    mockFeatureFlags.flags.multiCreator = false;
    mockFeatureFlags.flags.mainCreatorSlug = 'kraufanding';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  });

  it('omits the main creator channel in single-creator mode', async () => {
    const { default: sitemap } = await import('@/app/sitemap');

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com');
    expect(urls).not.toContain('https://example.com/channel/kraufanding');
  });

  it('includes the main creator channel in multi-creator mode', async () => {
    mockFeatureFlags.flags.multiCreator = true;
    const { default: sitemap } = await import('@/app/sitemap');

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://example.com/channel/kraufanding');
  });
});
