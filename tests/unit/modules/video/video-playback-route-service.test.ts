import { describe, expect, it } from 'vitest';
import { AccessTier, StorageProvider, VideoAssetProcessingState } from '@prisma/client';
import { VideoPlaybackRouteService } from '@/lib/modules/video/application/video-playback-route.service';

function ctxForRoute(assetOverrides: any = {}) {
  const calls: any = { routeUpdates: [], assetUpdateMany: [], assetUpdates: [], videoUpdates: [], auditCreates: [], claimUpdates: [] };
  const tx = {
    $queryRaw: async () => [{ id: 'job-1' }],
    auditLog: { create: async ({ data }: any) => { calls.auditCreates.push(data); return { id: 'audit-1' }; } },
    videoEncodeJob: { update: async ({ data }: any) => calls.claimUpdates.push(data) },
    videoPlaybackRoute: {
      updateMany: async ({ data }: any) => calls.routeUpdates.push(data),
      create: async ({ data }: any) => ({ id: 'route-new', ...data, createdAt: new Date(), updatedAt: new Date() }),
    },
    video: { update: async ({ data }: any) => calls.videoUpdates.push(data), updateMany: async ({ data }: any) => calls.videoUpdates.push(data) },
    videoAsset: { updateMany: async ({ data }: any) => calls.assetUpdateMany.push(data), update: async ({ data }: any) => calls.assetUpdates.push(data) },
  };
  const ctx = {
    actor: { type: 'admin', userId: 'admin-1' },
    prisma: {
      video: { findUnique: async () => ({ id: 'video-1', tier: AccessTier.PUBLIC }) },
      videoAsset: { findUnique: async () => ({ id: 'asset-1', videoId: 'video-1', provider: StorageProvider.SELF_HLS, processingState: VideoAssetProcessingState.READY, ...assetOverrides }) },
      auditLog: { create: async () => ({ id: 'audit-1' }) },
    },
    db: { writeTransaction: async (fn: any) => fn(tx) },
  } as any;
  return { ctx, calls };
}

describe('VideoPlaybackRouteService', () => {
  it('activates a ready asset and repairs legacy primary state', async () => {
    const { ctx, calls } = ctxForRoute();
    const route = await new VideoPlaybackRouteService().activateRoute({ videoId: 'video-1', assetId: 'asset-1', activatedBy: 'POLICY' }, ctx);
    expect(route.status).toBe('ACTIVE');
    expect(calls.routeUpdates[0]).toMatchObject({ status: 'PREVIOUS' });
    expect(calls.videoUpdates[0]).toMatchObject({ activePlaybackRouteId: 'route-new' });
    expect(calls.assetUpdateMany[0]).toMatchObject({ isPrimary: false });
    expect(calls.assetUpdates[0]).toMatchObject({ isPrimary: true });
    expect(calls.auditCreates[0]).toMatchObject({ action: 'VIDEO_PLAYBACK_ROUTE_ACTIVATED', targetId: 'video-1' });
  });

  it('locks and refreshes the current encode claim in the activation transaction', async () => {
    const { ctx, calls } = ctxForRoute();
    await new VideoPlaybackRouteService().activateRoute({
      videoId: 'video-1', assetId: 'asset-1', activatedBy: 'POLICY',
      encodeClaim: { jobId: 'job-1', workerId: 'worker-1', attemptId: 'attempt-1' },
    }, ctx);
    expect(calls.claimUpdates).toEqual([expect.objectContaining({ heartbeatAt: expect.any(Date) })]);
    expect(calls.auditCreates[0]).toMatchObject({ action: 'VIDEO_PLAYBACK_ROUTE_ACTIVATED' });
  });

  it('rejects non-ready assets', async () => {
    const { ctx } = ctxForRoute({ processingState: VideoAssetProcessingState.PROCESSING });
    await expect(new VideoPlaybackRouteService().activateRoute({ videoId: 'video-1', assetId: 'asset-1', activatedBy: 'POLICY' }, ctx)).rejects.toThrow(/READY assets/);
  });

  it.each([StorageProvider.CLOUDFLARE_STREAM, StorageProvider.MUX, StorageProvider.YOUTUBE, StorageProvider.VIMEO, StorageProvider.VERCEL_BLOB, StorageProvider.R2, StorageProvider.S3])('refuses to route a legacy %s asset, for any tier', async (provider) => {
    for (const tier of Object.values(AccessTier)) {
      const { ctx } = ctxForRoute({ provider });
      ctx.prisma.video.findUnique = async () => ({ id: 'video-1', tier });
      await expect(new VideoPlaybackRouteService().activateRoute({ videoId: 'video-1', assetId: 'asset-1', activatedBy: 'ADMIN' }, ctx)).rejects.toThrow(/cannot be activated/);
    }
  });
});
