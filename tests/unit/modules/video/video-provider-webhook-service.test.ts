import { describe, expect, it, vi } from 'vitest';
import { StorageProvider } from '@prisma/client';
import { VideoProviderWebhookService } from '@/lib/modules/video/application/video-provider-webhook.service';

function makeCtx() {
  const state: any = { event: null, assetUpdates: [], jobUpdates: [], targetUpdates: [] };
  const asset = { id: 'asset-1', videoId: 'video-1', provider: StorageProvider.MUX, providerAssetId: 'mux-asset', processingEndedAt: null };
  const job = { id: 'job-1', videoId: 'video-1', planId: 'plan-1', targetId: 'target-1', assetId: 'asset-1', provider: StorageProvider.MUX, providerAssetId: 'mux-asset', providerUploadId: null, completedAt: null };
  const ctx = {
    prisma: {
      videoProviderWebhookEvent: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => { state.event = { id: 'event-1', status: 'RECEIVED', ...data }; return state.event; }),
        update: vi.fn(async ({ data }: any) => { state.event = { ...state.event, ...data }; return state.event; }),
      },
      videoAsset: {
        findFirst: vi.fn(async () => asset),
        findUnique: vi.fn(async () => asset),
        update: vi.fn(async ({ data }: any) => { state.assetUpdates.push(data); return { ...asset, ...data }; }),
      },
      videoProviderJob: {
        findFirst: vi.fn(async () => job),
        update: vi.fn(async ({ data }: any) => { state.jobUpdates.push(data); return { ...job, ...data }; }),
      },
      videoDistributionTarget: {
        update: vi.fn(async ({ data }: any) => { state.targetUpdates.push(data); return data; }),
      },
    },
  } as any;
  return { ctx, state };
}

describe('VideoProviderWebhookService', () => {
  it('dedupes by provider and external event id', async () => {
    const { ctx } = makeCtx();
    ctx.prisma.videoProviderWebhookEvent.findUnique.mockResolvedValueOnce({ id: 'event-old', status: 'PROCESSED' });
    const orchestrator = { reconcileVideoDistribution: vi.fn() } as any;
    const result = await new VideoProviderWebhookService(orchestrator).ingestProviderWebhook({ provider: StorageProvider.MUX, externalEventId: 'evt-1', eventType: 'video.asset.ready', providerAssetId: 'mux-asset', state: 'READY', payload: {} }, ctx);
    expect(result).toMatchObject({ eventId: 'event-old', deduped: true, action: 'PROCESSED' });
    expect(ctx.prisma.videoProviderWebhookEvent.create).not.toHaveBeenCalled();
    expect(orchestrator.reconcileVideoDistribution).not.toHaveBeenCalled();
  });

  it('updates asset, job and target ready then delegates orchestration', async () => {
    const { ctx, state } = makeCtx();
    const orchestrator = { reconcileVideoDistribution: vi.fn() } as any;
    const result = await new VideoProviderWebhookService(orchestrator).ingestProviderWebhook({ provider: StorageProvider.MUX, externalEventId: 'evt-1', eventType: 'video.asset.ready', providerAssetId: 'mux-asset', state: 'READY', payload: {} }, ctx);
    expect(result).toMatchObject({ matchedAssetId: 'asset-1', matchedJobId: 'job-1', action: 'PROCESSED' });
    expect(state.assetUpdates.at(-1)).toMatchObject({ processingState: 'READY' });
    expect(state.jobUpdates.at(-1)).toMatchObject({ status: 'READY' });
    expect(state.targetUpdates.at(-1)).toMatchObject({ status: 'READY' });
    expect(orchestrator.reconcileVideoDistribution).toHaveBeenCalledWith({ videoId: 'video-1', planId: 'plan-1', reason: 'WEBHOOK' }, ctx);
  });

  it('stores unmatched webhooks as ignored without route activation', async () => {
    const { ctx, state } = makeCtx();
    ctx.prisma.videoAsset.findFirst.mockResolvedValueOnce(null);
    ctx.prisma.videoProviderJob.findFirst.mockResolvedValueOnce(null);
    const orchestrator = { reconcileVideoDistribution: vi.fn() } as any;
    const result = await new VideoProviderWebhookService(orchestrator).ingestProviderWebhook({ provider: StorageProvider.MUX, eventType: 'unknown', state: 'IGNORED', payload: {} }, ctx);
    expect(result.action).toBe('IGNORED');
    expect(state.event.status).toBe('IGNORED');
    expect(orchestrator.reconcileVideoDistribution).not.toHaveBeenCalled();
  });

  it('redacts signed URLs from persisted webhook failure fields', async () => {
    const { ctx, state } = makeCtx();
    await new VideoProviderWebhookService({ reconcileVideoDistribution: vi.fn() } as any).ingestProviderWebhook({ provider: StorageProvider.MUX, eventType: 'video.asset.errored', providerAssetId: 'mux-asset', state: 'FAILED', failureReason: 'bad https://r2.example/file.mp4?X-Amz-Signature=secret', payload: {} }, ctx);
    expect(JSON.stringify([state.assetUpdates, state.jobUpdates, state.targetUpdates])).toContain('X-Amz-Signature=[REDACTED]');
    expect(JSON.stringify([state.assetUpdates, state.jobUpdates, state.targetUpdates])).not.toContain('secret');
  });
});
