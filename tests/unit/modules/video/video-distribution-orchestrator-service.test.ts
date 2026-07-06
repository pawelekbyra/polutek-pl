import { describe, expect, it, vi } from 'vitest';
import { StorageProvider } from '@prisma/client';
import { VideoDistributionOrchestratorService } from '@/lib/modules/video/application/video-distribution-orchestrator.service';

vi.mock('@/lib/modules/video/application/publish-admin-video.use-case', () => ({
  publishAdminVideo: vi.fn(async () => ({ ok: true, data: { id: 'video-1' } })),
}));

const now = new Date('2026-07-05T00:00:00.000Z');
function readyAsset(id: string, provider: string, endedAt = now) {
  return { id, videoId: 'video-1', provider, processingState: 'READY', processingEndedAt: endedAt, updatedAt: endedAt };
}
function target(provider: string, assets: any[] = []) {
  return { id: `target-${provider}`, provider, status: assets.length ? 'READY' : 'QUEUED', updatedAt: now, providerAssets: assets, providerJobs: [] };
}
function ctxWithPlan(plan: any, activeRoute: any = null) {
  return { prisma: { video: { findUnique: vi.fn(async () => ({ id: 'video-1', activePlaybackRoute: activeRoute, distributionPlans: [plan] })), update: vi.fn(async () => ({})) }, videoDistributionPlan: { update: vi.fn(async () => ({})) }, videoDistributionTarget: { update: vi.fn(async () => ({})) } } } as any;
}

describe('VideoDistributionOrchestratorService', () => {
  it('activates Mux for single-provider Mux when ready', async () => {
    const routeService = { activateRoute: vi.fn(async (input) => ({ id: 'route-1', assetId: input.assetId, provider: StorageProvider.MUX })) } as any;
    const plan = { id: 'plan-1', selectionPolicy: 'PREFER_SELECTED', preferredProvider: StorageProvider.MUX, autopublishPolicy: 'NEVER', targets: [target(StorageProvider.MUX, [readyAsset('mux-asset', StorageProvider.MUX)])] };
    const decision = await new VideoDistributionOrchestratorService(routeService).reconcileVideoDistribution({ videoId: 'video-1', reason: 'JOB_UPDATED' }, ctxWithPlan(plan));
    expect(decision.activatedAssetId).toBe('mux-asset');
    expect(routeService.activateRoute).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'mux-asset' }), expect.anything());
  });

  it('manual policy does not auto activate', async () => {
    const routeService = { activateRoute: vi.fn() } as any;
    const plan = { id: 'plan-1', selectionPolicy: 'MANUAL', preferredProvider: null, autopublishPolicy: 'NEVER', targets: [target(StorageProvider.MUX, [readyAsset('mux-asset', StorageProvider.MUX)])] };
    const decision = await new VideoDistributionOrchestratorService(routeService).reconcileVideoDistribution({ videoId: 'video-1', reason: 'MANUAL' }, ctxWithPlan(plan));
    expect(decision.activeRouteChanged).toBe(false);
    expect(routeService.activateRoute).not.toHaveBeenCalled();
  });

  it('prefer selected switches from fallback to preferred unless route was admin selected', async () => {
    const routeService = { activateRoute: vi.fn(async (input) => ({ id: 'route-1', assetId: input.assetId, provider: StorageProvider.MUX })) } as any;
    const plan = { id: 'plan-1', selectionPolicy: 'PREFER_SELECTED', preferredProvider: StorageProvider.MUX, autopublishPolicy: 'NEVER', targets: [target(StorageProvider.CLOUDFLARE_STREAM, [readyAsset('cf-asset', StorageProvider.CLOUDFLARE_STREAM)]), target(StorageProvider.MUX, [readyAsset('mux-asset', StorageProvider.MUX)])] };
    await new VideoDistributionOrchestratorService(routeService).reconcileVideoDistribution({ videoId: 'video-1', reason: 'JOB_UPDATED' }, ctxWithPlan(plan, { assetId: 'cf-asset', activatedBy: 'POLICY', asset: readyAsset('cf-asset', StorageProvider.CLOUDFLARE_STREAM) }));
    expect(routeService.activateRoute).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'mux-asset' }), expect.anything());

    routeService.activateRoute.mockClear();
    await new VideoDistributionOrchestratorService(routeService).reconcileVideoDistribution({ videoId: 'video-1', reason: 'JOB_UPDATED' }, ctxWithPlan(plan, { assetId: 'cf-asset', activatedBy: 'ADMIN', asset: readyAsset('cf-asset', StorageProvider.CLOUDFLARE_STREAM) }));
    expect(routeService.activateRoute).not.toHaveBeenCalled();
  });

  it('uses deterministic FIRST_READY ordering by asset and target timestamps', async () => {
    const routeService = { activateRoute: vi.fn(async (input) => ({ id: 'route-1', assetId: input.assetId, provider: StorageProvider.MUX })) } as any;
    const early = new Date('2026-07-05T00:00:01.000Z');
    const late = new Date('2026-07-05T00:00:10.000Z');
    const cfTarget = { ...target(StorageProvider.CLOUDFLARE_STREAM, [readyAsset('cf-asset', StorageProvider.CLOUDFLARE_STREAM, late)]), updatedAt: early };
    const muxTarget = { ...target(StorageProvider.MUX, [readyAsset('mux-asset', StorageProvider.MUX, early)]), updatedAt: late };
    const plan = { id: 'plan-1', selectionPolicy: 'FIRST_READY', preferredProvider: null, autopublishPolicy: 'NEVER', targets: [cfTarget, muxTarget] };
    await new VideoDistributionOrchestratorService(routeService).reconcileVideoDistribution({ videoId: 'video-1', reason: 'JOB_UPDATED' }, ctxWithPlan(plan));
    expect(routeService.activateRoute).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'mux-asset' }), expect.anything());
  });

  it('autopublishes when active route is ready and policy allows it', async () => {
    const routeService = { activateRoute: vi.fn(async (input) => ({ id: 'route-1', assetId: input.assetId, provider: StorageProvider.MUX })) } as any;
    const plan = { id: 'plan-1', selectionPolicy: 'FIRST_READY', preferredProvider: null, autopublishPolicy: 'WHEN_ACTIVE_ROUTE_READY', targets: [target(StorageProvider.MUX, [readyAsset('mux-asset', StorageProvider.MUX)])] };
    const ctx = ctxWithPlan(plan);
    const decision = await new VideoDistributionOrchestratorService(routeService).reconcileVideoDistribution({ videoId: 'video-1', reason: 'JOB_UPDATED' }, ctx);
    expect(decision.publishAttempted).toBe(true);
    expect(decision.publishCompleted).toBe(true);
    expect(ctx.prisma.videoDistributionPlan.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publishError: null }) }));
  });

});
