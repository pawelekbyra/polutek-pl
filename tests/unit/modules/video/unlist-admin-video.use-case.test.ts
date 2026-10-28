import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlistAdminVideo, publishAdminVideo, unpublishAdminVideo, updateAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';

const syncPublicThumbnail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/modules/video/application/sync-public-thumbnail.service', () => ({ syncPublicThumbnail }));

describe('unlistAdminVideo and the PUBLISHED <-> UNLISTED <-> DRAFT transitions', () => {
  const channel = { id: 'c1', userId: 'owner1', slug: 'kanal', status: 'ACTIVE' };
  const mockPrisma = {
    video: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    appSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    creator: { findUnique: vi.fn(), findFirst: vi.fn() },
    channelMember: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockPrisma)),
  } as any;

  const route = { asset: { provider: 'SELF_HLS', processingState: 'READY', objectKey: 'videos/v1/v/v1' } };
  const draft = {
    id: 'v1', creatorId: 'c1', status: 'DRAFT', title: 'T', slug: 's', tier: 'PUBLIC',
    publishedAt: null, premiereAt: null, isMainFeatured: false, showInSidebar: false, publishAfterAssetReady: false,
    activePlaybackRoute: route,
  };
  const staffCtx = () => createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma: mockPrisma, channelId: 'c1', now: () => new Date('2026-10-14T10:00:00Z') } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.creator.findUnique.mockResolvedValue(channel);
    mockPrisma.creator.findFirst.mockResolvedValue(channel);
  });

  it('refuses a guest and a stranger before touching the video', async () => {
    const guest = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma, channelId: 'c1' } as any);
    expect((await unlistAdminVideo('v1', guest)).ok).toBe(false);
    expect(mockPrisma.video.findFirst).not.toHaveBeenCalled();

    mockPrisma.creator.findUnique.mockResolvedValue({ ...channel, members: [] });
    const stranger = createAppContext({ actor: { type: 'user', userId: 'stranger' }, prisma: mockPrisma, channelId: 'c1' } as any);
    expect((await unlistAdminVideo('v1', stranger)).ok).toBe(false);
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });

  it('unlists a ready draft: UNLISTED, dated now, no public slot, audited, public thumbnail dropped', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(draft);
    mockPrisma.video.update.mockResolvedValue({ ...draft, status: 'UNLISTED' });

    const result = await unlistAdminVideo('v1', staffCtx());

    expect(result.ok).toBe(true);
    const data = mockPrisma.video.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'UNLISTED', isMainFeatured: false, showInSidebar: false, publishAfterAssetReady: false, premiereAt: null });
    expect(data.publishedAt).toEqual(new Date('2026-10-14T10:00:00Z'));
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.action).toBe('VIDEO_UNLISTED');
    expect(syncPublicThumbnail).toHaveBeenCalledTimes(1);
    expect(syncPublicThumbnail.mock.calls[0][0]).toMatchObject({ id: 'v1', status: 'UNLISTED' });
  });

  it('respects the publication blockers for a draft (no READY route)', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...draft, activePlaybackRoute: null });
    const result = await unlistAdminVideo('v1', staffCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE');
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });

  it('refuses an archived video (restore it to a draft first)', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...draft, status: 'ARCHIVED' });
    const result = await unlistAdminVideo('v1', staffCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_PUBLICATION_ARCHIVED');
  });

  it('downgrades PUBLISHED to UNLISTED: drops hero/sidebar slots and a premiere, keeps the original date', async () => {
    const published = { ...draft, status: 'PUBLISHED', isMainFeatured: true, showInSidebar: true, publishedAt: new Date('2026-09-01T00:00:00Z'), premiereAt: new Date('2026-12-01T00:00:00Z') };
    mockPrisma.video.findFirst.mockResolvedValue(published);
    mockPrisma.video.update.mockResolvedValue({ ...published, status: 'UNLISTED' });

    const result = await unlistAdminVideo('v1', staffCtx());

    expect(result.ok).toBe(true);
    const data = mockPrisma.video.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'UNLISTED', isMainFeatured: false, showInSidebar: false, premiereAt: null });
    expect(data.publishedAt).toEqual(new Date('2026-09-01T00:00:00Z'));
  });

  it('is idempotent for an already unlisted video', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...draft, status: 'UNLISTED' });
    const result = await unlistAdminVideo('v1', staffCtx());
    expect(result.ok).toBe(true);
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('UNLISTED -> PUBLISHED goes through publish and dates the video from now', async () => {
    const unlisted = { ...draft, status: 'UNLISTED', publishedAt: new Date('2026-09-01T00:00:00Z') };
    mockPrisma.video.findFirst.mockResolvedValue(unlisted);
    mockPrisma.video.update.mockResolvedValue({ ...unlisted, status: 'PUBLISHED' });

    const result = await publishAdminVideo('v1', staffCtx());

    expect(result.ok).toBe(true);
    const data = mockPrisma.video.update.mock.calls[0][0].data;
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt.getTime()).toBeGreaterThan(new Date('2026-09-01T00:00:00Z').getTime());
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.action).toBe('VIDEO_PUBLISHED');
  });

  it('publishing an unlisted video that lost its READY route is blocked', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ ...draft, status: 'UNLISTED', activePlaybackRoute: null });
    const result = await publishAdminVideo('v1', staffCtx());
    expect(result.ok).toBe(false);
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });

  it('UNLISTED -> DRAFT is "unpublish"', async () => {
    const unlisted = { ...draft, status: 'UNLISTED' };
    mockPrisma.video.findFirst.mockResolvedValue(unlisted);
    mockPrisma.video.update.mockResolvedValue({ ...unlisted, status: 'DRAFT' });

    const result = await unpublishAdminVideo('v1', staffCtx());

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.update.mock.calls[0][0].data).toMatchObject({ status: 'DRAFT', showInSidebar: false, isMainFeatured: false });
  });

  describe('through updateAdminVideo (status field)', () => {
    it('does not let an update set UNLISTED on a video that is not ready', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({ ...draft, activePlaybackRoute: null, assets: [] });
      const result = await updateAdminVideo({ id: 'v1', status: 'UNLISTED' } as any, staffCtx());
      expect(result.ok).toBe(false);
      expect(mockPrisma.video.update).not.toHaveBeenCalled();
    });

    it('does not let an update set UNLISTED together with a premiere', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({ ...draft, assets: [] });
      const result = await updateAdminVideo({ id: 'v1', status: 'UNLISTED', premiereAt: new Date('2026-12-01T00:00:00Z') } as any, staffCtx());
      expect(result.ok).toBe(false);
    });

    it('does not let an archived video jump to UNLISTED', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({ ...draft, status: 'ARCHIVED', assets: [] });
      const result = await updateAdminVideo({ id: 'v1', status: 'UNLISTED' } as any, staffCtx());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VIDEO_PUBLICATION_ARCHIVED');
    });
  });
});
