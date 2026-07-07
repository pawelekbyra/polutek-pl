import { describe, expect, it, vi } from 'vitest';
import { AccessTier, StorageProvider, VideoAssetProcessingState } from '@prisma/client';
import { makeSourcePrimary } from '@/lib/modules/video/application/make-source-primary.use-case';

const readyMuxAsset = {
  id: 'asset-mux',
  videoId: 'video-1',
  provider: StorageProvider.MUX,
  processingState: VideoAssetProcessingState.READY,
  isPrimary: false,
  externalVideoId: null,
  updatedAt: new Date('2026-07-05T00:00:00.000Z'),
};
const previousAsset = {
  id: 'asset-cf',
  videoId: 'video-1',
  provider: StorageProvider.CLOUDFLARE_STREAM,
  processingState: VideoAssetProcessingState.READY,
  isPrimary: true,
  externalVideoId: null,
  updatedAt: new Date('2026-07-05T00:00:01.000Z'),
};

function ctx() {
  const calls = { videoUpdates: [] as any[], assetUpdateMany: [] as any[], assetUpdates: [] as any[], routeCreates: [] as any[] };
  const tx = {
    videoPlaybackRoute: {
      updateMany: vi.fn(async () => ({})),
      create: vi.fn(async ({ data }) => { calls.routeCreates.push(data); return { id: 'route-mux', ...data, createdAt: new Date(), updatedAt: new Date() }; }),
    },
    video: {
      update: vi.fn(async ({ data }) => { calls.videoUpdates.push(data); return {}; }),
      updateMany: vi.fn(async ({ data }) => { calls.videoUpdates.push(data); return {}; }),
    },
    videoAsset: {
      updateMany: vi.fn(async ({ data }) => { calls.assetUpdateMany.push(data); return {}; }),
      update: vi.fn(async ({ data }) => { calls.assetUpdates.push(data); return {}; }),
    },
  };
  const appCtx = {
    actor: { type: 'admin', userId: 'admin-1' },
    prisma: {
      creator: { findUnique: vi.fn(async () => ({ id: 'creator-1', isApproved: true, isPrimary: true })) },
      video: {
        findUnique: vi.fn(async () => ({ id: 'video-1', creatorId: 'creator-1', tier: AccessTier.PUBLIC, assets: [previousAsset, readyMuxAsset] })),
        findFirst: vi.fn(async () => ({ id: 'video-1', creatorId: 'creator-1', tier: AccessTier.PUBLIC, assets: [{ ...previousAsset, isPrimary: false }, { ...readyMuxAsset, isPrimary: true }], originals: [] })),
      },
      videoAsset: { findUnique: vi.fn(async () => readyMuxAsset) },
      auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
    },
    db: { writeTransaction: vi.fn(async (fn) => fn(tx)) },
  } as any;
  return { appCtx, calls };
}

describe('makeSourcePrimary compatibility path', () => {
  it('activates a playback route instead of only flipping legacy primary state', async () => {
    const { appCtx, calls } = ctx();
    const result = await makeSourcePrimary({ videoId: 'video-1', assetId: 'asset-mux' }, appCtx);

    expect(result.ok).toBe(true);
    expect(calls.routeCreates[0]).toMatchObject({ videoId: 'video-1', assetId: 'asset-mux', status: 'ACTIVE', activatedBy: 'ADMIN' });
    expect(calls.videoUpdates[0]).toMatchObject({ activePlaybackRouteId: 'route-mux' });
    expect(calls.assetUpdateMany[0]).toMatchObject({ isPrimary: false });
    expect(calls.assetUpdates[0]).toMatchObject({ isPrimary: true });
  });
});
