import { describe, expect, it } from 'vitest';
import { StorageProvider } from '@prisma/client';
import { normalizeLegacyMirrorPlan, normalizeVideoDistributionStrategy } from '@/lib/modules/video/domain/video-distribution.types';

function normalized(input: Parameters<typeof normalizeLegacyMirrorPlan>[0]) {
  return normalizeVideoDistributionStrategy(normalizeLegacyMirrorPlan(input));
}

describe('normalizeLegacyMirrorPlan', () => {
  it('maps mux only to single Mux', () => {
    expect(normalized({ mirrorPlan: { mux: true } })).toMatchObject({
      mode: 'SINGLE_PROVIDER',
      providers: [StorageProvider.MUX],
      preferredProvider: StorageProvider.MUX,
    });
  });

  it('maps cloudflare only to single Cloudflare Stream', () => {
    expect(normalized({ mirrorPlan: { cloudflare: true } })).toMatchObject({
      mode: 'SINGLE_PROVIDER',
      providers: [StorageProvider.CLOUDFLARE_STREAM],
      preferredProvider: StorageProvider.CLOUDFLARE_STREAM,
    });
  });

  it('maps both providers to multi provider', () => {
    expect(normalized({ mirrorPlan: { mux: true, cloudflare: true }, preferredProvider: 'MUX' })).toMatchObject({
      mode: 'MULTI_PROVIDER',
      providers: [StorageProvider.CLOUDFLARE_STREAM, StorageProvider.MUX],
      preferredProvider: StorageProvider.MUX,
      selectionPolicy: 'PREFER_SELECTED',
    });
  });

  it('maps neither provider to manual', () => {
    expect(normalized({ mirrorPlan: {} })).toMatchObject({
      mode: 'MANUAL',
      providers: [],
      preferredProvider: null,
      autopublishPolicy: 'NEVER',
    });
  });

  it('ignores preferred provider when it was not selected', () => {
    expect(normalized({ mirrorPlan: { cloudflare: true }, preferredProvider: 'MUX' })).toMatchObject({
      mode: 'SINGLE_PROVIDER',
      providers: [StorageProvider.CLOUDFLARE_STREAM],
      preferredProvider: StorageProvider.CLOUDFLARE_STREAM,
    });
  });
});
