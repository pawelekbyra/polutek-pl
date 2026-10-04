import { describe, expect, it, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique },
    video: { findMany },
  },
}));

vi.mock('@/lib/modules/channel/application/main-channel.service', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: 'creator-1' }),
  },
}));

describe('ChannelLayoutService patron access truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([
      {
        id: 'public-video',
        slug: 'public-video',
        title: 'Public video',
        titleEn: null,
        thumbnailUrl: '/thumb.jpg',
        tier: 'PUBLIC',
        status: 'PUBLISHED',
        duration: null,
        views: 0,
        publishedAt: null,
        creator: { id: 'creator-1', name: 'Creator', slug: 'creator' },
      },
      {
        id: 'patron-video',
        slug: 'patron-video',
        title: 'Patron video',
        titleEn: null,
        thumbnailUrl: '/thumb.jpg',
        tier: 'PATRON',
        status: 'PUBLISHED',
        duration: null,
        views: 0,
        publishedAt: null,
        creator: { id: 'creator-1', name: 'Creator', slug: 'creator' },
      },
    ]);
  });

  it('never reveals whether the viewer tipped: no PatronGrant read, no PATRON viewer state', async () => {
    findUnique.mockResolvedValue({ role: 'USER' });

    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout('user-1');

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: { role: true } }));
    expect(layout.viewerState).toBe('LOGGED_IN');
    expect(JSON.stringify(layout)).not.toContain('patronGrant');
  });

  // CLAUDE.md §4.4: PATRON tier needs sign-in only, exactly like LOGGED_IN.
  it('unlocks patron sidebar items for a signed-in user without an active PatronGrant', async () => {
    findUnique.mockResolvedValue({ role: 'USER' });

    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout('user-1');

    expect(layout.viewerState).toBe('LOGGED_IN');
    expect(layout.sections.find((section) => section.type === 'PATRON')?.items[0]?.isLocked).toBe(false);
  });

  it('keeps patron sidebar items locked for guests', async () => {
    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout(null);

    expect(layout.viewerState).toBe('ANONYMOUS');
    expect(layout.sections.find((section) => section.type === 'PATRON')?.items[0]?.isLocked).toBe(true);
  });
});
