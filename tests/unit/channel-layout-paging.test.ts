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

function video(n: number, tier = 'PUBLIC') {
  return {
    id: `v${String(n).padStart(3, '0')}`,
    slug: `v${n}`,
    title: `Film ${n}`,
    titleEn: null,
    thumbnailUrl: '/thumb.jpg',
    tier,
    status: 'PUBLISHED',
    duration: null,
    views: 0,
    // Newer first: a higher number is older, so the order is v001, v002, ...
    publishedAt: new Date(Date.now() - (n + 1) * DAY),
    premiereAt: null,
    sidebarOrder: 0,
    createdAt: new Date(Date.now() - (n + 1) * DAY),
    creatorId: 'creator-1',
    creator: { id: 'creator-1', name: 'Creator', slug: 'creator' },
  };
}

async function layout(page?: Record<string, unknown>) {
  const { ChannelLayoutService } = await import('@/lib/modules/channel/application/channel-layout.service');
  return ChannelLayoutService.getSidebarLayout(null, undefined, {}, page);
}

/** W03: long sections are sent in pages; order and section membership do not change. */
describe('ChannelLayoutService paging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
    const rows = [
      ...Array.from({ length: 30 }, (_, i) => video(i + 1)),
      ...Array.from({ length: 5 }, (_, i) => video(i + 101, 'LOGGED_IN')),
    ];
    // The database order is not the sort order: the service sorts.
    findMany.mockResolvedValue([...rows].reverse());
  });

  it('sends the first page of every section with the section totals', async () => {
    const result = await layout();
    const free = result.sections.find((s) => s.type === 'FREE')!;
    const loggedIn = result.sections.find((s) => s.type === 'LOGGED_IN')!;

    expect(free.items).toHaveLength(24);
    expect(free.total).toBe(30);
    expect(free.items.map((i) => i.id)[0]).toBe('v001');
    expect(free.items.at(-1)!.id).toBe('v024');
    expect(loggedIn.items).toHaveLength(5);
    expect(loggedIn.total).toBe(5);
  });

  it('returns the next page of one section, continuing the same order', async () => {
    const result = await layout({ section: 'FREE', offset: 24 });

    expect(result.sections.map((s) => s.type)).toEqual(['FREE']);
    expect(result.sections[0].items.map((i) => i.id)).toEqual(['v025', 'v026', 'v027', 'v028', 'v029', 'v030']);
    expect(result.sections[0].total).toBe(30);
  });

  it('answers an offset past the end with an empty window, not an error', async () => {
    const result = await layout({ section: 'FREE', offset: 500 });
    expect(result.sections[0].items).toEqual([]);
  });

  it('caps the page size', async () => {
    const result = await layout({ section: 'FREE', offset: 0, limit: 9999 });
    expect(result.sections[0].items.length).toBeLessThanOrEqual(60);
  });
});
