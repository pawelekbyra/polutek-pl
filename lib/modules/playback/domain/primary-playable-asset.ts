import { VideoAssetProcessingState, StorageProvider } from '@prisma/client';

export type PrimaryPlayableAssetInput = {
  isPrimary: boolean;
  processingState: VideoAssetProcessingState;
  provider: StorageProvider;
};

export type PrimaryPlayableAssetState =
  | 'READY'
  | 'NO_PRIMARY_ASSET'
  | 'PROCESSING'
  | 'FAILED'
  | 'VIDEO_NOT_READY';

export type PrimaryPlayableAssetResult = {
  state: PrimaryPlayableAssetState;
  asset?: PrimaryPlayableAssetInput;
  warnings: string[];
  canResolveProviderSource: boolean;
};

const PROCESSING_STATES = new Set(['PENDING', 'UPLOADING', 'PROCESSING']);

/**
 * Central stored-state boundary for #1106 provider playback selection.
 *
 * This helper does not call Cloudflare or any storage provider. It answers only
 * whether the persisted primary VideoAsset is eligible for provider-backed
 * playback. Legacy Video.videoUrl fallback is intentionally outside this helper
 * and must remain an explicit migration branch in PlaybackService.
 */
export function getPrimaryPlayableAsset(asset: PrimaryPlayableAssetInput | null | undefined): PrimaryPlayableAssetResult {
  if (!asset || !asset.isPrimary) {
    return {
      state: 'NO_PRIMARY_ASSET',
      asset: asset ?? undefined,
      warnings: ['No primary video asset is available'],
      canResolveProviderSource: false,
    };
  }

  if (PROCESSING_STATES.has(asset.processingState)) {
    return {
      state: 'PROCESSING',
      asset,
      warnings: [`Video asset is ${asset.processingState}`],
      canResolveProviderSource: false,
    };
  }

  if (asset.processingState === 'FAILED') {
    return {
      state: 'FAILED',
      asset,
      warnings: ['Video asset processing failed'],
      canResolveProviderSource: false,
    };
  }

  if (asset.processingState !== 'READY') {
    return {
      state: 'VIDEO_NOT_READY',
      asset,
      warnings: ['Video asset is not ready'],
      canResolveProviderSource: false,
    };
  }

  return {
    state: 'READY',
    asset,
    warnings: [],
    canResolveProviderSource: true,
  };
}
