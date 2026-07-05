import { describe, expect, it, vi } from 'vitest';
import { StorageProvider } from '@prisma/client';
import { VideoDistributionBackfillService } from '@/lib/modules/video/application/video-distribution-backfill.service';

function video(overrides: Partial<any> = {}) {
  return { id: 'video-1', tier: 'PUBLIC', activeOriginalId: null, assets: [], originals: [], distributionPlans: [], activePlaybackRoute: null, ...overrides };
}
function makeCtx(videos: any[]) {
  const state: any = { videoUpdates: [], assetUpdates: [] };
  return { ctx: { actor: { type: 'admin', userId: 'admin-1' }, prisma: {
    video: { findMany: vi.fn(async () => videos), update: vi.fn(async ({ data }: any) => { state.videoUpdates.push(data); return data; }) },
    videoAsset: { update: vi.fn(async ({ data }: any) => { state.assetUpdates.push(data); return data; }) },
  } } as any, state };
}

describe('VideoDistributionBackfillService', () => {
  it('creates a single Mux plan/target for Mux-only legacy asset and activates legacy primary route', async () => {
    const routeService = { activateRoute: vi.fn(), repairLegacyPrimaryFromRoute: vi.fn() } as any;
    const planService = { createOrReplaceActivePlan: vi.fn(async () => ({ id: 'plan-1', targets: [{ id: 'target-1', provider: StorageProvider.MUX }] })) } as any;
    const { ctx, state } = makeCtx([video({ assets: [{ id: 'asset-1', provider: StorageProvider.MUX, processingState: 'READY', isPrimary: true }], originals: [{ id: 'original-1', status: 'READY' }] })]);
    const result = await new VideoDistributionBackfillService(routeService, planService).backfillExistingVideos({ dryRun: false }, ctx);
    expect(result).toMatchObject({ scannedVideos: 1, createdPlans: 1, createdTargets: 1, createdRoutes: 1 });
    expect(planService.createOrReplaceActivePlan).toHaveBeenCalledWith(expect.objectContaining({ strategy: { mode: 'SINGLE_PROVIDER', provider: StorageProvider.MUX } }), ctx);
    expect(state.assetUpdates.at(-1)).toMatchObject({ distributionTargetId: 'target-1' });
    expect(routeService.activateRoute).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-1', activatedBy: 'MIGRATION' }), ctx);
  });

  it('creates multi-provider plan when Cloudflare and Mux legacy assets exist', async () => {
    const planService = { createOrReplaceActivePlan: vi.fn(async () => ({ id: 'plan-1', targets: [] })) } as any;
    const assets = [
      { id: 'cf', provider: StorageProvider.CLOUDFLARE_STREAM, processingState: 'READY', isPrimary: false },
      { id: 'mux', provider: StorageProvider.MUX, processingState: 'READY', isPrimary: true },
    ];
    const { ctx } = makeCtx([video({ assets })]);
    await new VideoDistributionBackfillService({ activateRoute: vi.fn(), repairLegacyPrimaryFromRoute: vi.fn() } as any, planService).backfillExistingVideos({ dryRun: false }, ctx);
    expect(planService.createOrReplaceActivePlan).toHaveBeenCalledWith(expect.objectContaining({ strategy: expect.objectContaining({ mode: 'MULTI_PROVIDER', preferredProvider: StorageProvider.MUX }) }), ctx);
  });

  it('does not overwrite an existing active route', async () => {
    const routeService = { activateRoute: vi.fn(), repairLegacyPrimaryFromRoute: vi.fn() } as any;
    const { ctx } = makeCtx([video({ activePlaybackRoute: { id: 'route-1' }, distributionPlans: [{ id: 'plan-1', targets: [] }], assets: [{ id: 'asset-1', provider: StorageProvider.CLOUDFLARE_STREAM, processingState: 'READY', isPrimary: true }] })]);
    await new VideoDistributionBackfillService(routeService, { createOrReplaceActivePlan: vi.fn() } as any).backfillExistingVideos({ dryRun: false }, ctx);
    expect(routeService.activateRoute).not.toHaveBeenCalled();
    expect(routeService.repairLegacyPrimaryFromRoute).toHaveBeenCalledWith('video-1', ctx);
  });

  it('dry run performs no writes', async () => {
    const routeService = { activateRoute: vi.fn(), repairLegacyPrimaryFromRoute: vi.fn() } as any;
    const planService = { createOrReplaceActivePlan: vi.fn() } as any;
    const { ctx, state } = makeCtx([video({ assets: [{ id: 'asset-1', provider: StorageProvider.MUX, processingState: 'READY', isPrimary: true }] })]);
    const result = await new VideoDistributionBackfillService(routeService, planService).backfillExistingVideos({ dryRun: true }, ctx);
    expect(result).toMatchObject({ scannedVideos: 1, skippedVideos: 1 });
    expect(planService.createOrReplaceActivePlan).not.toHaveBeenCalled();
    expect(state.assetUpdates).toEqual([]);
  });
});
