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

const DAY = 86_400_000;

function video(id: string, tier: string, premiereAt: Date | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    title: id,
    titleEn: null,
    thumbnailUrl: '/thumb.jpg',
    tier,
    status: 'PUBLISHED',
    duration: null,
    views: 0,
    publishedAt: new Date(Date.now() - 10 * DAY),
    premiereAt,
    sidebarOrder: 0,
    createdAt: new Date(Date.now() - 10 * DAY),
    creatorId: 'creator-1',
    creator: { id: 'creator-1', name: 'Creator', slug: 'creator' },
    ...extra,
  };
}

/** CLAUDE.md "Premieres": upcoming videos live in their own UPCOMING section. */
describe('ChannelLayoutService UPCOMING section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ role: 'USER', patronGrants: [] });
    findMany.mockResolvedValue([
      video('public-now', 'PUBLIC', null),
      video('premiere-later', 'PUBLIC', new Date(Date.now() + 5 * DAY)),
      video('premiere-soon', 'PATRON', new Date(Date.now() + 1 * DAY)),
      video('premiered-already', 'LOGGED_IN', new Date(Date.now() - 1 * DAY)),
    ]);
  });

  async function layoutFor(userId: string | null) {
    const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
    return ChannelLayoutService.getSidebarLayout(userId);
  }

  it('lists upcoming premieres soonest first, with their premiere time', async () => {
    const layout = await layoutFor('user-1');
    const upcoming = layout.sections.find((s) => s.type === 'UPCOMING');

    expect(upcoming?.items.map((i) => i.id)).toEqual(['premiere-soon', 'premiere-later']);
    expect(upcoming?.items[0].premiereAt).toEqual(expect.any(String));
  });

  it('keeps upcoming premieres out of their tier sections', async () => {
    const layout = await layoutFor('user-1');
    const tierIds = layout.sections
      .filter((s) => s.type !== 'UPCOMING')
      .flatMap((s) => s.items.map((i) => i.id));

    expect(tierIds).toEqual(expect.arrayContaining(['public-now', 'premiered-already']));
    expect(tierIds).not.toContain('premiere-soon');
    expect(tierIds).not.toContain('premiere-later');
    // Two access levels only: no section of the old PATRON tier exists.
    expect(layout.sections.map((s) => s.type)).not.toContain('PATRON');
  });

  it('treats a past premiere as an ordinary video dated from its premiere', async () => {
    const layout = await layoutFor('user-1');
    const item = layout.sections.flatMap((s) => s.items).find((i) => i.id === 'premiered-already');

    expect(layout.sections.find((s) => s.items.some((i) => i.id === 'premiered-already'))?.type).toBe('LOGGED_IN');
    expect(item?.isLocked).toBe(false);
    expect(new Date(item!.publishedAt!).getTime()).toBeGreaterThan(Date.now() - 2 * DAY);
  });

  it('locks upcoming premieres for guests and signed-in users alike (never playable early)', async () => {
    for (const userId of [null, 'user-1']) {
      const layout = await layoutFor(userId);
      const upcoming = layout.sections.find((s) => s.type === 'UPCOMING');
      expect(upcoming?.items.every((i) => i.isLocked)).toBe(true);
    }
  });

  it('has no UPCOMING section when nothing is scheduled', async () => {
    findMany.mockResolvedValue([video('public-now', 'PUBLIC', null)]);
    const layout = await layoutFor(null);
    expect(layout.sections.find((s) => s.type === 'UPCOMING')).toBeUndefined();
  });
});
