import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';

const mockMainChannel = { id: 'c1', slug: 'polutek', status: 'ACTIVE' };

function makeVideo(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-06-25T00:00:00.000Z');
  return {
    id: 'v1',
    creatorId: 'c1',
    slug: 'video-one',
    title: 'Video One',
    titleEn: null,
    description: null,
    descriptionEn: null,
    thumbnailUrl: '',
    duration: null,
    tier: 'PUBLIC',
    views: 0,
    likesCount: 0,
    dislikesCount: 0,
    publishedAt: null,
    isMainFeatured: false,
    showInSidebar: true,
    sidebarOrder: 0,
    videoUrl: null,
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    _count: { comments: 0 },
    asset: null,
    publishAfterAssetReady: false,
    publishAfterAssetReadyRequestedAt: null,
    publishAfterAssetReadyCompletedAt: null,
    publishAfterAssetReadyError: null,
    ...overrides,
  };
}

function makeAsset(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-06-25T00:00:00.000Z');
  return {
    id: 'asset1',
    videoId: 'v1',
    provider: 'SELF_HLS',
    objectKey: 'videos/v1/v/v1',
    bucket: null,
    processingState: 'READY',
    isPrimary: true,
    failureReason: null,
    processingEndedAt: null,
    mimeType: null,
    sizeBytes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCtx() {
  const prisma: any = {
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
    video: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn((cb) => cb(prisma));
  return {
    prisma,
    ctx: createAppContext({ actor: { type: 'admin', userId: 'a1' }, prisma }),
  };
}

describe('deleteAdminVideo use-case', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns VIDEO_NOT_FOUND when the video is missing', async () => {
    const { prisma, ctx } = makeCtx();
    prisma.video.findUnique.mockResolvedValue(null);

    const result = await deleteAdminVideo('missing-video', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_NOT_FOUND');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.video.delete).not.toHaveBeenCalled();
  });

  it('returns VIDEO_NOT_ON_MAIN_CHANNEL for a video outside the main channel', async () => {
    const { prisma, ctx } = makeCtx();
    prisma.video.findUnique.mockResolvedValue(makeVideo({ creatorId: 'other-channel' }));

    const result = await deleteAdminVideo('v1', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VIDEO_NOT_ON_MAIN_CHANNEL');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.video.delete).not.toHaveBeenCalled();
  });

  it('deletes the video record and audits it, with no call to any external provider', async () => {
    const { prisma, ctx } = makeCtx();
    const existing = makeVideo({ asset: makeAsset() });
    prisma.video.findUnique.mockResolvedValue(existing);
    prisma.video.delete.mockResolvedValue(existing);

    const result = await deleteAdminVideo('v1', ctx);

    expect(result.ok).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.video.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v1' } }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'VIDEO_DELETED',
        metadata: expect.objectContaining({ provider: 'SELF_HLS', slug: 'video-one' }),
      }),
    }));
  });

  it('deletes a video that has no asset', async () => {
    const { prisma, ctx } = makeCtx();
    const existing = makeVideo({ asset: null });
    prisma.video.findUnique.mockResolvedValue(existing);
    prisma.video.delete.mockResolvedValue(existing);

    const result = await deleteAdminVideo('v1', ctx);

    expect(result.ok).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'VIDEO_DELETED',
        metadata: expect.objectContaining({ provider: null }),
      }),
    }));
  });
});
