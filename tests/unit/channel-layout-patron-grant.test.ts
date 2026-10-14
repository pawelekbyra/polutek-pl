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

    // Stage 8: the layout never reads User.role; staff status arrives from the resolved Actor.
    expect(findUnique).not.toHaveBeenCalled();
    expect(layout.viewerState).toBe('LOGGED_IN');
    expect(JSON.stringify(layout)).not.toContain('patronGrant');
  });

  // Two access levels (lib/access-tier.ts): a leftover PATRON row is a "Dla zalogowanych" video.
  it('puts a leftover PATRON video into the signed-in section, unlocked for any signed-in user', async () => {
    findUnique.mockResolvedValue({ role: 'USER' });

    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout('user-1');

    expect(layout.viewerState).toBe('LOGGED_IN');
    expect(layout.sections.map((section) => section.type)).toEqual(['FREE', 'LOGGED_IN']);
    const item = layout.sections.find((section) => section.type === 'LOGGED_IN')?.items[0];
    expect(item).toMatchObject({ id: 'patron-video', tier: 'LOGGED_IN', isLocked: false });
  });

  it('marks the viewer as ADMIN only when the caller (the resolved Actor) says staff', async () => {
    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout('admin-1', undefined, { isStaff: true });

    expect(layout.viewerState).toBe('ADMIN');
    expect(findUnique).not.toHaveBeenCalled();
    expect(layout.sections.find((section) => section.type === 'LOGGED_IN')?.items[0]).toMatchObject({ isLocked: false });
  });

  it('keeps it locked for guests', async () => {
    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout(null);

    expect(layout.viewerState).toBe('ANONYMOUS');
    expect(layout.sections.find((section) => section.type === 'LOGGED_IN')?.items[0]).toMatchObject({ id: 'patron-video', isLocked: true });
  });
});
