import { describe, expect, it } from 'vitest';
import { AccessTier, StorageProvider } from '@prisma/client';
import {
  canProviderServeTier,
  isAutomaticFilePlaybackProvider,
  isEmbedOnlyProvider,
  isPlaybackProvider,
} from '@/lib/modules/video/domain/video-provider-capabilities';

describe('video provider capabilities', () => {
  it('marks Cloudflare Stream and Mux as automatic file playback providers', () => {
    expect(isAutomaticFilePlaybackProvider(StorageProvider.CLOUDFLARE_STREAM)).toBe(true);
    expect(isAutomaticFilePlaybackProvider(StorageProvider.MUX)).toBe(true);
  });

  it('marks YouTube and Vimeo as embed-only providers', () => {
    expect(isEmbedOnlyProvider(StorageProvider.YOUTUBE)).toBe(true);
    expect(isEmbedOnlyProvider(StorageProvider.VIMEO)).toBe(true);
  });

  it('does not treat original storage providers as playback providers', () => {
    expect(isPlaybackProvider(StorageProvider.R2)).toBe(false);
    expect(isPlaybackProvider(StorageProvider.S3)).toBe(false);
    expect(isPlaybackProvider(StorageProvider.VERCEL_BLOB)).toBe(false);
  });

  it('blocks embed-only providers from patron-tier playback', () => {
    expect(canProviderServeTier(StorageProvider.YOUTUBE, AccessTier.PATRON)).toBe(false);
    expect(canProviderServeTier(StorageProvider.VIMEO, AccessTier.PATRON)).toBe(false);
  });

  it('allows automatic signed providers to serve patron-tier playback', () => {
    expect(canProviderServeTier(StorageProvider.CLOUDFLARE_STREAM, AccessTier.PATRON)).toBe(true);
    expect(canProviderServeTier(StorageProvider.MUX, AccessTier.PATRON)).toBe(true);
  });
});
