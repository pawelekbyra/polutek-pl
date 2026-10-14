import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelAutoPublish } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('cancelAutoPublish use-case', () => {
  const channel = { id: 'c1', slug: 'polutek', userId: 'owner', status: 'ACTIVE' };
  const prisma = {
    video: { findFirst: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(channel) },
    channelMember: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((cb) => cb(prisma)),
  } as any;
  const ownerCtx = createAppContext({ actor: { type: 'user', userId: 'owner' }, prisma });
  const staffCtx = createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma });

  const draft = (extra: object = {}) => ({ id: 'v1', creatorId: 'c1', status: 'DRAFT', publishAfterAssetReady: true, ...extra });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAIN_CREATOR_SLUG = 'polutek';
    prisma.creator.findUnique.mockResolvedValue(channel);
    prisma.video.updateMany.mockResolvedValue({ count: 1 });
  });

  it('clears the flag and records an audit row', async () => {
    prisma.video.findFirst
      .mockResolvedValueOnce(draft())
      .mockResolvedValueOnce(draft({ publishAfterAssetReady: false }));
    const result = await cancelAutoPublish('v1', staffCtx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.publishAfterAssetReady).toBe(false);
    expect(prisma.video.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'v1', creatorId: 'c1', publishAfterAssetReady: true }),
      data: expect.objectContaining({ publishAfterAssetReady: false, publishAfterAssetReadyRequestedAt: null }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'VIDEO_PUBLISH_AFTER_ASSET_READY_CANCELLED' }),
    }));
  });

  it('is idempotent: a video without the flag is returned untouched, nothing written', async () => {
    prisma.video.findFirst.mockResolvedValue(draft({ publishAfterAssetReady: false }));
    const result = await cancelAutoPublish('v1', staffCtx);
    expect(result.ok).toBe(true);
    expect(prisma.video.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not touch an already published video', async () => {
    prisma.video.findFirst.mockResolvedValue(draft({ status: 'PUBLISHED' }));
    const result = await cancelAutoPublish('v1', staffCtx);
    expect(result.ok).toBe(true);
    expect(prisma.video.updateMany).not.toHaveBeenCalled();
  });

  it('answers not found for a video that is not in the channel', async () => {
    prisma.video.findFirst.mockResolvedValue(null);
    const result = await cancelAutoPublish('v1', staffCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_NOT_FOUND');
  });

  it('is authorized: a guest is refused before any read of the video', async () => {
    const guest = createAppContext({ actor: { type: 'guest' }, prisma });
    const result = await cancelAutoPublish('v1', guest);
    expect(result.ok).toBe(false);
    expect(prisma.video.findFirst).not.toHaveBeenCalled();
    expect(prisma.video.updateMany).not.toHaveBeenCalled();
  });

  it('lets the channel owner cancel', async () => {
    prisma.video.findFirst.mockResolvedValue(draft());
    const result = await cancelAutoPublish('v1', ownerCtx);
    expect(result.ok).toBe(true);
    expect(prisma.video.updateMany).toHaveBeenCalled();
  });
});
