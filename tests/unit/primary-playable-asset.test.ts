import { describe, expect, it } from 'vitest';
import { getPrimaryPlayableAsset } from '@/lib/services/playback/primary-playable-asset';

describe('getPrimaryPlayableAsset', () => {
  it('selects a READY primary Cloudflare Stream asset for provider-backed playback', () => {
    const asset = { provider: 'CLOUDFLARE_STREAM', isPrimary: true, processingState: 'READY' };

    const result = getPrimaryPlayableAsset(asset);

    expect(result.state).toBe('READY');
    expect(result.asset).toBe(asset);
    expect(result.canResolveProviderSource).toBe(true);
  });

  it.each(['PENDING', 'UPLOADING', 'PROCESSING'])('returns not-playable processing state for %s assets', (processingState) => {
    const result = getPrimaryPlayableAsset({ provider: 'CLOUDFLARE_STREAM', isPrimary: true, processingState });

    expect(result.state).toBe('PROCESSING');
    expect(result.canResolveProviderSource).toBe(false);
    expect(result.warnings).toEqual([`Video asset is ${processingState}`]);
  });

  it('fails closed for a FAILED primary asset without allowing legacy fallback inside the selector', () => {
    const result = getPrimaryPlayableAsset({ provider: 'CLOUDFLARE_STREAM', isPrimary: true, processingState: 'FAILED' });

    expect(result.state).toBe('FAILED');
    expect(result.canResolveProviderSource).toBe(false);
    expect(result.warnings).toEqual(['Video asset processing failed']);
  });

  it('requires an explicit primary asset', () => {
    expect(getPrimaryPlayableAsset(null).state).toBe('NO_PRIMARY_ASSET');
    expect(getPrimaryPlayableAsset({ provider: 'CLOUDFLARE_STREAM', isPrimary: false, processingState: 'READY' }).state).toBe('NO_PRIMARY_ASSET');
  });
});
