import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteAdminVideo } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';

const mockMainChannel = { id: 'c1', slug: 'polutek', isApproved: true, isPrimary: true };

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
    provider: 'CLOUDFLARE_STREAM',
    objectKey: 'cf-uid-1',
    bucket: null,
    providerAssetId: 'cf-uid-1',
    providerPlaybackId: null,
    processingState: 'READY',
    isPrimary: true,
    failureReason: null,
    providerSyncedAt: null,
    processingStartedAt: null,
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
    creator: { findUnique: vi.fn().mockResolvedValue(mockMainChannel) },
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
    process.env.MAIN_CREATOR_SLUG = 'polutek';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-1';
    process.env.CLOUDFLARE_API_TOKEN = 'token-1';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
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

  it('deletes the Cloudflare Stream asset before deleting the video record', async () => {
    const { prisma, ctx } = makeCtx();
    const existing = makeVideo({ asset: makeAsset({ providerAssetId: 'cf-uid-1' }) });
    prisma.video.findUnique.mockResolvedValue(existing);
    prisma.video.delete.mockResolvedValue(existing);
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    const result = await deleteAdminVideo('v1', ctx);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-1/stream/cf-uid-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(prisma.video.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v1' } }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'VIDEO_DELETED',
        metadata: expect.objectContaining({
          cloudflareDeletionRequired: true,
          cloudflareDeleted: true,
          cloudflareAlreadyDeleted: false,
        }),
      }),
    }));
  });

  it('does not delete the video record when Cloudflare returns an error', async () => {
    const { prisma, ctx } = makeCtx();
    prisma.video.findUnique.mockResolvedValue(makeVideo({ asset: makeAsset() }));
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({ errors: [{ code: 1000, message: 'boom' }] }), { status: 500 }));

    const result = await deleteAdminVideo('v1', ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLOUDFLARE_API_ERROR');
    expect(prisma.video.delete).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('deletes the video without a Cloudflare API call when no Cloudflare asset is linked', async () => {
    const { prisma, ctx } = makeCtx();
    const existing = makeVideo({ asset: null });
    prisma.video.findUnique.mockResolvedValue(existing);
    prisma.video.delete.mockResolvedValue(existing);

    const result = await deleteAdminVideo('v1', ctx);

    expect(result.ok).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.video.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v1' } }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'VIDEO_DELETED',
        metadata: expect.objectContaining({ cloudflareDeletionRequired: false }),
      }),
    }));
  });

  it('treats a Cloudflare 404 as already cleaned up and deletes the video record', async () => {
    const { prisma, ctx } = makeCtx();
    const existing = makeVideo({ asset: makeAsset() });
    prisma.video.findUnique.mockResolvedValue(existing);
    prisma.video.delete.mockResolvedValue(existing);
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 404 }));

    const result = await deleteAdminVideo('v1', ctx);

    expect(result.ok).toBe(true);
    expect(prisma.video.delete).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          cloudflareDeleted: false,
          cloudflareAlreadyDeleted: true,
        }),
      }),
    }));
  });
});
