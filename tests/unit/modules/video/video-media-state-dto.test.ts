import { describe, expect, it } from 'vitest';
import { buildAdminVideoMediaDto } from '@/lib/modules/video/application/video-media-state.dto';

const now = new Date('2026-07-05T00:00:00.000Z');

function asset(overrides: Partial<any> = {}) {
  return {
    id: 'asset-1',
    provider: 'CLOUDFLARE_STREAM',
    processingState: 'READY',
    isPrimary: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function original(overrides: Partial<any> = {}) {
  return {
    id: 'original-1',
    status: 'READY',
    version: 1,
    originalFileName: 'video.mp4',
    sizeBytes: BigInt(100),
    uploadCompletedAt: now,
    ...overrides,
  };
}

describe('buildAdminVideoMediaDto', () => {
  it('returns NO_ORIGINAL when no original exists', () => {
    const dto = buildAdminVideoMediaDto({ videoId: 'video-1' });
    expect(dto.summary.state).toBe('NO_ORIGINAL');
    expect(dto.summary.canPlay).toBe(false);
  });

  it('returns WAITING_UPLOAD for uploading originals', () => {
    const dto = buildAdminVideoMediaDto({
      videoId: 'video-1',
      activeOriginal: original({ status: 'UPLOADING' }),
    });
    expect(dto.summary.state).toBe('WAITING_UPLOAD');
  });

  it('returns READY when the active route points to a ready asset', () => {
    const readyAsset = asset({ id: 'route-asset' });
    const dto = buildAdminVideoMediaDto({
      videoId: 'video-1',
      activeOriginal: original(),
      activeRoute: {
        id: 'route-1',
        provider: 'CLOUDFLARE_STREAM',
        assetId: readyAsset.id,
        activatedBy: 'POLICY',
        activatedAt: now,
        asset: readyAsset,
      },
    });
    expect(dto.summary.state).toBe('READY');
    expect(dto.summary.canPlay).toBe(true);
    expect(dto.summary.canPublish).toBe(true);
  });

  it('does not allow publishing from an original alone without an active playback route', () => {
    const dto = buildAdminVideoMediaDto({
      videoId: 'video-1',
      activeOriginal: original(),
    });
    expect(dto.summary.state).toBe('ORIGINAL_READY');
    expect(dto.summary.canPlay).toBe(false);
    expect(dto.summary.canPublish).toBe(false);
  });

  it('returns MANUAL_ACTION_REQUIRED for manual plan without route', () => {
    const dto = buildAdminVideoMediaDto({
      videoId: 'video-1',
      activeOriginal: original(),
      activePlan: {
        id: 'plan-1',
        mode: 'MANUAL',
        selectionPolicy: 'MANUAL',
        autopublishPolicy: 'NEVER',
        targets: [],
      },
    });
    expect(dto.summary.state).toBe('MANUAL_ACTION_REQUIRED');
  });

  it('uses legacy primary fallback and adds warning when no active route exists', () => {
    const dto = buildAdminVideoMediaDto({
      videoId: 'video-1',
      activeOriginal: original(),
      legacyAssets: [asset({ isPrimary: true })],
    });
    expect(dto.summary.state).toBe('LEGACY_FALLBACK');
    expect(dto.summary.canPlay).toBe(true);
    expect(dto.summary.canPublish).toBe(false);
    expect(dto.summary.warnings).toContain('No active playback route found; using legacy primary asset selection.');
  });
});
