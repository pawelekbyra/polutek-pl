import { describe, expect, it, vi } from 'vitest';
import { VideoRepository } from '@/lib/modules/video/infrastructure/video.repository';
import { StorageProvider, VideoAssetProcessingState, type VideoAsset } from '@prisma/client';

function asset(overrides: Partial<VideoAsset> = {}): VideoAsset {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: overrides.id ?? 'asset-1',
    videoId: overrides.videoId ?? 'video-1',
    distributionTargetId: overrides.distributionTargetId ?? null,
    provider: overrides.provider ?? StorageProvider.CLOUDFLARE_STREAM,
    objectKey: overrides.objectKey ?? 'cloudflare/asset-1',
    bucket: overrides.bucket ?? null,
    providerAssetId: overrides.providerAssetId ?? 'provider-1',
    providerPlaybackId: overrides.providerPlaybackId ?? null,
    externalVideoId: overrides.externalVideoId ?? null,
    externalUrl: overrides.externalUrl ?? null,
    processingState: overrides.processingState ?? VideoAssetProcessingState.READY,
    isPrimary: overrides.isPrimary ?? false,
    failureReason: overrides.failureReason ?? null,
    providerSyncedAt: overrides.providerSyncedAt ?? null,
    processingStartedAt: overrides.processingStartedAt ?? null,
    processingEndedAt: overrides.processingEndedAt ?? null,
    mimeType: overrides.mimeType ?? null,
    sizeBytes: overrides.sizeBytes ?? null,
    pendingPrimaryIntent: overrides.pendingPrimaryIntent ?? false,
    muxUploadId: overrides.muxUploadId ?? null,
    fallbackPriority: overrides.fallbackPriority ?? 0,
    mirrorSourceOriginalId: overrides.mirrorSourceOriginalId ?? null,
    mirrorRequestedAt: overrides.mirrorRequestedAt ?? null,
    mirrorCompletedAt: overrides.mirrorCompletedAt ?? null,
    mirrorFailureReason: overrides.mirrorFailureReason ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('VideoRepository 1:N asset compatibility helpers', () => {
  it('lists multiple assets for one video', async () => {
    const assets = [asset({ id: 'primary', isPrimary: true }), asset({ id: 'secondary' })];
    const db = { videoAsset: { findMany: vi.fn().mockResolvedValue(assets) } } as any;
    const repository = new VideoRepository(db);

    await expect(repository.listAssetsForVideo('video-1')).resolves.toEqual(assets);
    expect(db.videoAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { videoId: 'video-1' } }));
  });

  it('upsertPrimaryAsset updates existing primary without creating a duplicate', async () => {
    const primary = asset({ id: 'primary', isPrimary: true });
    const tx = {
      videoAsset: {
        findMany: vi.fn().mockResolvedValue([primary, asset({ id: 'secondary' })]),
        update: vi.fn().mockResolvedValue({ ...primary, providerAssetId: 'updated' }),
        create: vi.fn(),
      },
    } as any;
    const repository = new VideoRepository({} as any);

    await repository.upsertPrimaryAsset('video-1', { providerAssetId: 'updated' }, tx);

    expect(tx.videoAsset.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'primary' } }));
    expect(tx.videoAsset.create).not.toHaveBeenCalled();
  });

  it('upsertPrimaryAsset creates a primary when none exists', async () => {
    const created = asset({ id: 'created', isPrimary: true });
    const tx = {
      videoAsset: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue(created),
      },
    } as any;
    const repository = new VideoRepository({} as any);

    await repository.upsertPrimaryAsset('video-1', { providerAssetId: 'created' }, tx);

    expect(tx.videoAsset.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ videoId: 'video-1', isPrimary: true }) }));
    expect(tx.videoAsset.update).not.toHaveBeenCalled();
  });

  it('ensureSinglePrimaryAsset keeps one deterministic primary', async () => {
    const keep = asset({ id: 'keep', isPrimary: true, updatedAt: new Date('2026-01-02T00:00:00Z') });
    const unset = asset({ id: 'unset', isPrimary: true, updatedAt: new Date('2026-01-01T00:00:00Z') });
    const tx = {
      videoAsset: {
        findMany: vi.fn().mockResolvedValue([keep, unset]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
    } as any;
    const repository = new VideoRepository({} as any);

    await expect(repository.ensureSinglePrimaryAsset('video-1', tx)).resolves.toBe(keep);
    expect(tx.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { videoId: 'video-1', id: { not: 'keep' }, isPrimary: true },
      data: { isPrimary: false },
    });
  });
});
