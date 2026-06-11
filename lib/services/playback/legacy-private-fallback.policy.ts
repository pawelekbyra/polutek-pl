import type { AccessTier } from '@prisma/client';

const PROVIDER_BACKED_PLAYBACK_PROVIDERS = new Set(['CLOUDFLARE_STREAM', 'MUX']);

export type PlaybackPolicyAsset = {
  provider?: string | null;
  processingState?: string | null;
  isPrimary?: boolean | null;
} | null | undefined;

export function isLegacyPrivatePlaybackFallbackAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_LEGACY_PRIVATE_FALLBACK === 'true';
}

export function hasReadyProviderBackedPlaybackAsset(asset: PlaybackPolicyAsset): boolean {
  return Boolean(
    asset?.isPrimary
      && asset.processingState === 'READY'
      && asset.provider
      && PROVIDER_BACKED_PLAYBACK_PROVIDERS.has(asset.provider),
  );
}

export function shouldBlockLegacyPrivatePlaybackFallback(args: {
  tier?: AccessTier | string | null;
  asset?: PlaybackPolicyAsset;
  env?: NodeJS.ProcessEnv;
}): boolean {
  if (args.tier !== 'PATRON') return false;
  if (isLegacyPrivatePlaybackFallbackAllowed(args.env)) return false;

  return !hasReadyProviderBackedPlaybackAsset(args.asset);
}
