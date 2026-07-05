import { describe, expect, it } from 'vitest';
import { AccessTier, StorageProvider, VideoAssetProcessingState } from '@prisma/client';
import { VideoPlaybackRouteService } from '@/lib/modules/video/application/video-playback-route.service';

function ctxForRoute(assetOverrides: any = {}) {
  const calls: any = { routeUpdates: [], assetUpdateMany: [], assetUpdates: [], videoUpdates: [] };
  const tx = {
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
      videoAsset: { findUnique: async () => ({ id: 'asset-1', videoId: 'video-1', provider: StorageProvider.MUX, processingState: VideoAssetProcessingState.READY, ...assetOverrides }) },
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
  });

  it('rejects non-ready assets', async () => {
    const { ctx } = ctxForRoute({ processingState: VideoAssetProcessingState.PROCESSING });
    await expect(new VideoPlaybackRouteService().activateRoute({ videoId: 'video-1', assetId: 'asset-1', activatedBy: 'POLICY' }, ctx)).rejects.toThrow(/READY assets/);
  });

  it('rejects patron playback for embed-only providers', async () => {
    const { ctx } = ctxForRoute({ provider: StorageProvider.YOUTUBE });
    ctx.prisma.video.findUnique = async () => ({ id: 'video-1', tier: AccessTier.PATRON });
    await expect(new VideoPlaybackRouteService().activateRoute({ videoId: 'video-1', assetId: 'asset-1', activatedBy: 'ADMIN' }, ctx)).rejects.toThrow(/cannot be activated/);
  });
});
