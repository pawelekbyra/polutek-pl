import { describe, expect, it, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique },
    video: { findMany },
  },
}));

vi.mock('@/lib/channel/main-channel.service', () => ({
  MainChannelService: {
    getPublicRequired: vi.fn().mockResolvedValue({ id: 'creator-1' }),
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

  it('uses active PatronGrant, not legacy User.isPatron cache, to unlock patron sidebar items', async () => {
    findUnique.mockResolvedValue({
      role: 'USER',
      patronGrants: [{ id: 'grant-1' }],
    });

    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout('user-1');

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        patronGrants: expect.objectContaining({
          where: { revokedAt: null },
        }),
      }),
    }));
    expect(layout.viewerState).toBe('PATRON');
    expect(layout.sections.find((section) => section.type === 'PATRON')?.items[0]?.isLocked).toBe(false);
  });

  it('keeps patron sidebar items locked when no active PatronGrant exists', async () => {
    findUnique.mockResolvedValue({
      role: 'USER',
      patronGrants: [],
    });

    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    const layout = await ChannelLayoutService.getSidebarLayout('user-1');

    expect(layout.viewerState).toBe('LOGGED_IN');
    expect(layout.sections.find((section) => section.type === 'PATRON')?.items[0]?.isLocked).toBe(true);
  });
});
