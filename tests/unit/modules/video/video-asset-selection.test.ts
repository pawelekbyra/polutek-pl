import { describe, expect, it, vi } from 'vitest';
import { VideoAssetProcessingState, StorageProvider, type VideoAsset } from '@prisma/client';
import { selectPrimaryVideoAsset } from '@/lib/modules/video/domain/video-asset-selection';

function asset(overrides: Partial<VideoAsset> = {}): VideoAsset {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: overrides.id ?? 'asset-1',
    videoId: 'video-1',
    provider: StorageProvider.CLOUDFLARE_STREAM,
    objectKey: 'cloudflare/asset',
    bucket: null,
    providerAssetId: null,
    providerPlaybackId: null,
    processingState: overrides.processingState ?? VideoAssetProcessingState.PROCESSING,
    isPrimary: overrides.isPrimary ?? false,
    failureReason: null,
    providerSyncedAt: null,
    processingStartedAt: null,
    processingEndedAt: null,
    mimeType: null,
    sizeBytes: null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('selectPrimaryVideoAsset', () => {
  it('returns null for empty assets', () => {
    expect(selectPrimaryVideoAsset([])).toBeNull();
    expect(selectPrimaryVideoAsset(null)).toBeNull();
    expect(selectPrimaryVideoAsset(undefined)).toBeNull();
  });

  it('returns the only primary asset', () => {
    const primary = asset({ id: 'primary', isPrimary: true });
    expect(selectPrimaryVideoAsset([asset({ id: 'other' }), primary])).toBe(primary);
  });

  it('returns READY asset first when no primary exists', () => {
    const ready = asset({ id: 'ready', processingState: VideoAssetProcessingState.READY });
    expect(selectPrimaryVideoAsset([asset({ id: 'processing' }), ready])).toBe(ready);
  });

  it('selects deterministically when multiple primary assets exist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const older = asset({ id: 'older', isPrimary: true, updatedAt: new Date('2026-01-01T00:00:00Z') });
    const newer = asset({ id: 'newer', isPrimary: true, updatedAt: new Date('2026-01-02T00:00:00Z') });
    expect(selectPrimaryVideoAsset([older, newer])).toBe(newer);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('returns deterministic first asset when no primary or READY asset exists', () => {
    const newer = asset({ id: 'newer', updatedAt: new Date('2026-01-02T00:00:00Z') });
    const older = asset({ id: 'older', updatedAt: new Date('2026-01-01T00:00:00Z') });
    expect(selectPrimaryVideoAsset([older, newer])).toBe(newer);
  });
});
