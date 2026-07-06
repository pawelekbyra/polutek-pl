import { describe, expect, it, vi } from 'vitest';
import { StorageProvider, VideoProviderJobStatus } from '@prisma/client';
import { VideoProviderJobService } from '@/lib/modules/video/application/video-provider-job.service';
import { PlaybackProviderRegistry } from '@/lib/modules/video/infrastructure/playback-provider-registry';

function makeCtx(overrides: Partial<any> = {}) {
  const state: any = { jobUpdates: [], targetUpdates: [], assetCreates: [], assetUpdates: [] };
  const job = {
    id: 'job-1', videoId: 'video-1', planId: 'plan-1', targetId: 'target-1', originalId: 'original-1', assetId: null,
    provider: StorageProvider.MUX, type: 'IMPORT_FROM_ORIGINAL', status: VideoProviderJobStatus.QUEUED,
    attemptCount: 0, maxAttempts: 3,
    target: { id: 'target-1', desiredPrimary: true },
    plan: { id: 'plan-1' },
    original: { id: 'original-1', objectKey: 'originals/video.mp4', originalFileName: 'video.mp4', mimeType: 'video/mp4' },
    ...overrides.job,
  };
  const ctx = {
    prisma: {
      videoProviderJob: {
        findUnique: vi.fn(async () => job),
        update: vi.fn(async ({ data }: any) => { state.jobUpdates.push(data); Object.assign(job, data); return job; }),
        upsert: vi.fn(),
      },
      videoDistributionTarget: {
        update: vi.fn(async ({ data }: any) => { state.targetUpdates.push(data); return data; }),
      },
      videoAsset: {
        create: vi.fn(async ({ data }: any) => { state.assetCreates.push(data); return { id: 'asset-1', ...data }; }),
        update: vi.fn(async ({ data }: any) => { state.assetUpdates.push(data); return { id: 'asset-1', ...data }; }),
      },
    },
  } as any;
  return { ctx, state, job };
}

function registry(configured = true, createImpl?: any) {
  return new PlaybackProviderRegistry([{ provider: StorageProvider.MUX, isConfigured: () => configured, createAssetFromOriginal: createImpl ?? vi.fn(async () => ({ providerAssetId: 'mux-asset', providerPlaybackId: 'playback', initialState: 'PROCESSING' })), getAssetStatus: vi.fn() } as any]);
}

describe('VideoProviderJobService', () => {
  it('marks job and target failed without fake asset when provider is not configured', async () => {
    const { ctx, state } = makeCtx();
    await new VideoProviderJobService(registry(false), {} as any, { reconcileVideoDistribution: vi.fn() } as any).startQueuedJob({ jobId: 'job-1' }, ctx);
    expect(state.assetCreates).toEqual([]);
    expect(state.jobUpdates.at(-1)).toMatchObject({ status: 'FAILED', lastError: 'MUX not configured' });
    expect(state.targetUpdates.at(-1)).toMatchObject({ status: 'FAILED', lastError: 'MUX not configured' });
  });

  it('starts an import job and creates a linked VideoAsset without storing signed URL', async () => {
    const { ctx, state } = makeCtx();
    const sourceUrls = { createProviderImportUrl: vi.fn(async () => ({ url: 'https://r2.example/video.mp4?X-Amz-Signature=secret', expiresAt: new Date(), objectKey: 'originals/video.mp4' })) };
    await new VideoProviderJobService(registry(true), sourceUrls as any, { reconcileVideoDistribution: vi.fn() } as any).startQueuedJob({ jobId: 'job-1' }, ctx);
    expect(state.assetCreates[0]).toMatchObject({ distributionTargetId: 'target-1', provider: StorageProvider.MUX, processingState: 'PENDING' });
    expect(JSON.stringify(state.jobUpdates)).not.toContain('X-Amz-Signature=secret');
  });

  it('redacts signed URL from adapter failure persisted on job and target', async () => {
    const { ctx, state } = makeCtx();
    const sourceUrls = { createProviderImportUrl: vi.fn(async () => ({ url: 'https://r2.example/video.mp4?X-Amz-Signature=secret', expiresAt: new Date(), objectKey: 'originals/video.mp4' })) };
    const failingCreate = vi.fn(async () => { throw new Error('failed https://r2.example/video.mp4?X-Amz-Signature=secret'); });
    await new VideoProviderJobService(registry(true, failingCreate), sourceUrls as any, { reconcileVideoDistribution: vi.fn() } as any).startQueuedJob({ jobId: 'job-1' }, ctx);
    expect(state.jobUpdates.at(-1).lastError).toContain('X-Amz-Signature=[REDACTED]');
    expect(state.jobUpdates.at(-1).lastError).not.toContain('secret');
  });

  it('respects max attempts unless force', async () => {
    const { ctx } = makeCtx({ job: { status: VideoProviderJobStatus.FAILED, attemptCount: 3, maxAttempts: 3 } });
    await expect(new VideoProviderJobService(registry(true), {} as any, { reconcileVideoDistribution: vi.fn() } as any).retryJob({ jobId: 'job-1' }, ctx)).rejects.toThrow(/max attempts/);
  });
});
