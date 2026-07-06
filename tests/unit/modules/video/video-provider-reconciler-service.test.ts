import { describe, expect, it, vi } from 'vitest';
import { StorageProvider } from '@prisma/client';
import { VideoProviderReconcilerService } from '@/lib/modules/video/application/video-provider-reconciler.service';
import { PlaybackProviderRegistry } from '@/lib/modules/video/infrastructure/playback-provider-registry';

function makeJob(overrides: Partial<any> = {}) {
  return { id: 'job-1', videoId: 'video-1', planId: 'plan-1', targetId: 'target-1', assetId: 'asset-1', provider: StorageProvider.MUX, providerAssetId: 'mux-asset', providerPlaybackId: null, providerUploadId: null, status: 'WAITING_PROVIDER', attemptCount: 0, maxAttempts: 3, updatedAt: new Date('2026-07-05T00:00:00Z'), asset: { id: 'asset-1', processingEndedAt: null }, target: { id: 'target-1' }, plan: { id: 'plan-1', isActive: true }, completedAt: null, ...overrides };
}
function makeCtx(job: any) {
  const state: any = { jobUpdates: [], assetUpdates: [], targetUpdates: [] };
  return {
    ctx: { prisma: {
      videoProviderJob: { findMany: vi.fn(async () => [job]), update: vi.fn(async ({ data }: any) => { state.jobUpdates.push(data); return { ...job, ...data }; }) },
      videoAsset: { update: vi.fn(async ({ data }: any) => { state.assetUpdates.push(data); return data; }) },
      videoDistributionTarget: { update: vi.fn(async ({ data }: any) => { state.targetUpdates.push(data); return data; }) },
    } } as any,
    state,
  };
}
function registry(status: any, configured = true) {
  return new PlaybackProviderRegistry([{ provider: StorageProvider.MUX, isConfigured: () => configured, getAssetStatus: vi.fn(async () => status), createAssetFromOriginal: vi.fn() } as any]);
}

describe('VideoProviderReconcilerService', () => {
  it('updates waiting job, asset and target to ready and calls orchestrator', async () => {
    const job = makeJob();
    const { ctx, state } = makeCtx(job);
    const orchestrator = { reconcileVideoDistribution: vi.fn() } as any;
    const result = await new VideoProviderReconcilerService(registry({ state: 'READY', providerAssetId: 'mux-asset', providerPlaybackId: 'playback' }), orchestrator, {} as any).reconcilePendingProviderJobs({}, ctx);
    expect(result).toMatchObject({ scannedJobs: 1, syncedJobs: 1, readyJobs: 1 });
    expect(state.assetUpdates.at(-1)).toMatchObject({ processingState: 'READY', providerPlaybackId: 'playback' });
    expect(state.jobUpdates.at(-1)).toMatchObject({ status: 'READY', providerPlaybackId: 'playback' });
    expect(state.targetUpdates.at(-1)).toMatchObject({ status: 'READY' });
    expect(orchestrator.reconcileVideoDistribution).toHaveBeenCalledWith({ videoId: 'video-1', planId: 'plan-1', reason: 'CRON_RECONCILE' }, ctx);
  });

  it('keeps processing provider jobs waiting', async () => {
    const { ctx, state } = makeCtx(makeJob());
    const result = await new VideoProviderReconcilerService(registry({ state: 'PROCESSING' }), { reconcileVideoDistribution: vi.fn() } as any, {} as any).reconcilePendingProviderJobs({}, ctx);
    expect(result.syncedJobs).toBe(1);
    expect(state.jobUpdates.at(-1)).toMatchObject({ status: 'WAITING_PROVIDER' });
    expect(state.targetUpdates.at(-1)).toMatchObject({ status: 'WAITING_PROVIDER' });
  });

  it('dry run reports sync without writes', async () => {
    const { ctx, state } = makeCtx(makeJob());
    const result = await new VideoProviderReconcilerService(registry({ state: 'READY' }), { reconcileVideoDistribution: vi.fn() } as any, {} as any).reconcilePendingProviderJobs({ dryRun: true }, ctx);
    expect(result.syncedJobs).toBe(1);
    expect(state.jobUpdates).toEqual([]);
    expect(state.assetUpdates).toEqual([]);
  });

  it('retries stale failed jobs only when eligible', async () => {
    const { ctx } = makeCtx(makeJob({ status: 'FAILED', nextAttemptAt: new Date('2026-07-04T00:00:00Z') }));
    const jobService = { retryJob: vi.fn() } as any;
    const result = await new VideoProviderReconcilerService(registry({ state: 'READY' }), { reconcileVideoDistribution: vi.fn() } as any, jobService).reconcilePendingProviderJobs({}, ctx);
    expect(result.retriedJobs).toBe(1);
    expect(jobService.retryJob).toHaveBeenCalledWith({ jobId: 'job-1' }, ctx);
  });
});
