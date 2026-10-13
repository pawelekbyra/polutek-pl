import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unpublishAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';

const syncPublicThumbnail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/modules/video/application/sync-public-thumbnail.service', () => ({ syncPublicThumbnail }));

describe('unpublishAdminVideo use-case', () => {
  const channel = { id: 'c1', userId: 'owner1', status: 'ACTIVE', slug: 'kanal', isApproved: true, isPrimary: false };
  const mockPrisma = {
    video: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    creator: { findUnique: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockPrisma)),
  } as any;

  const staffCtx = () => createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma: mockPrisma, channelId: 'c1' } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.creator.findUnique.mockResolvedValue(channel);
    mockPrisma.creator.findFirst.mockResolvedValue(channel);
  });

  it('returns VIDEO_NOT_FOUND when the video is not in the channel', async () => {
    mockPrisma.video.findFirst.mockResolvedValue(null);
    const result = await unpublishAdminVideo('v1', staffCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_NOT_FOUND');
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });

  it('refuses a guest before touching the video', async () => {
    const ctx = createAppContext({ actor: { type: 'guest' }, prisma: mockPrisma, channelId: 'c1' } as any);
    const result = await unpublishAdminVideo('v1', ctx);
    expect(result.ok).toBe(false);
    expect(mockPrisma.video.findFirst).not.toHaveBeenCalled();
  });

  it('refuses a user who is not a member of the channel', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ ...channel, members: [] });
    const ctx = createAppContext({ actor: { type: 'user', userId: 'stranger' }, prisma: mockPrisma, channelId: 'c1' } as any);
    const result = await unpublishAdminVideo('v1', ctx);
    expect(result.ok).toBe(false);
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });

  it('sets DRAFT, clears featured and sidebar flags, audits before/after and drops the public thumbnail', async () => {
    const existing = { id: 'v1', creatorId: 'c1', status: 'PUBLISHED', isMainFeatured: true, showInSidebar: true, title: 'T' };
    mockPrisma.video.findFirst.mockResolvedValue(existing);
    mockPrisma.video.update.mockResolvedValue({ ...existing, status: 'DRAFT', isMainFeatured: false, showInSidebar: false });

    const result = await unpublishAdminVideo('v1', staffCtx());

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'v1' },
      data: expect.objectContaining({ status: 'DRAFT', isMainFeatured: false, showInSidebar: false, publishAfterAssetReady: false }),
    }));
    const audit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe('VIDEO_UNPUBLISHED');
    expect(JSON.stringify(audit)).toContain('PUBLISHED');
    expect(syncPublicThumbnail).toHaveBeenCalledTimes(1);
    expect(syncPublicThumbnail.mock.calls[0][0]).toMatchObject({ id: 'v1', status: 'DRAFT' });
  });

  it('restores an ARCHIVED video as a draft', async () => {
    const existing = { id: 'v1', creatorId: 'c1', status: 'ARCHIVED', isMainFeatured: false, showInSidebar: false, title: 'T' };
    mockPrisma.video.findFirst.mockResolvedValue(existing);
    mockPrisma.video.update.mockResolvedValue({ ...existing, status: 'DRAFT' });

    const result = await unpublishAdminVideo('v1', staffCtx());

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) }));
  });

  it('is idempotent for a draft: no write, no audit, no sync', async () => {
    mockPrisma.video.findFirst.mockResolvedValue({ id: 'v1', creatorId: 'c1', status: 'DRAFT', isMainFeatured: false, showInSidebar: false });

    const result = await unpublishAdminVideo('v1', staffCtx());

    expect(result.ok).toBe(true);
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(syncPublicThumbnail).not.toHaveBeenCalled();
  });
});
