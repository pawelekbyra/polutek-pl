import { AccessTier, StorageProvider } from "@prisma/client";

export type PlaybackProviderKind =
  | "CLOUDFLARE_STREAM"
  | "MUX"
  | "YOUTUBE"
  | "VIMEO";

export type PlaybackProviderCapability = {
  provider: StorageProvider;
  label: string;
  kind: "AUTOMATIC_FILE" | "EMBED_ONLY" | "ORIGINAL_STORAGE" | "UNSUPPORTED";
  supportsAutomaticFileImport: boolean;
  supportsDirectUpload: boolean;
  supportsAttachExisting: boolean;
  supportsSignedPlayback: boolean;
  supportsPublicPlayback: boolean;
  supportsProviderAssetDeletion: boolean;
  supportsStatusSync: boolean;
  supportsPatronTier: boolean;
  defaultCostRank: number;
};

const automaticFileProvider = (
  provider: StorageProvider,
  label: string,
  defaultCostRank: number,
): PlaybackProviderCapability => ({
  provider,
  label,
  kind: "AUTOMATIC_FILE",
  supportsAutomaticFileImport: true,
  supportsDirectUpload: true,
  supportsAttachExisting: true,
  supportsSignedPlayback: true,
  supportsPublicPlayback: true,
  supportsProviderAssetDeletion: true,
  supportsStatusSync: true,
  supportsPatronTier: true,
  defaultCostRank,
});

const embedOnlyProvider = (
  provider: StorageProvider,
  label: string,
  defaultCostRank: number,
): PlaybackProviderCapability => ({
  provider,
  label,
  kind: "EMBED_ONLY",
  supportsAutomaticFileImport: false,
  supportsDirectUpload: false,
  supportsAttachExisting: true,
  supportsSignedPlayback: false,
  supportsPublicPlayback: true,
  supportsProviderAssetDeletion: false,
  supportsStatusSync: false,
  supportsPatronTier: false,
  defaultCostRank,
});

const originalStorageProvider = (
  provider: StorageProvider,
  label: string,
): PlaybackProviderCapability => ({
  provider,
  label,
  kind: "ORIGINAL_STORAGE",
  supportsAutomaticFileImport: false,
  supportsDirectUpload: false,
  supportsAttachExisting: false,
  supportsSignedPlayback: false,
  supportsPublicPlayback: false,
  supportsProviderAssetDeletion: false,
  supportsStatusSync: false,
  supportsPatronTier: false,
  defaultCostRank: Number.MAX_SAFE_INTEGER,
});

const unsupportedProvider = (provider: StorageProvider): PlaybackProviderCapability => ({
  provider,
  label: provider,
  kind: "UNSUPPORTED",
  supportsAutomaticFileImport: false,
  supportsDirectUpload: false,
  supportsAttachExisting: false,
  supportsSignedPlayback: false,
  supportsPublicPlayback: false,
  supportsProviderAssetDeletion: false,
  supportsStatusSync: false,
  supportsPatronTier: false,
  defaultCostRank: Number.MAX_SAFE_INTEGER,
});

const PROVIDER_CAPABILITIES: Record<StorageProvider, PlaybackProviderCapability> = {
  [StorageProvider.R2]: originalStorageProvider(StorageProvider.R2, "Cloudflare R2"),
  [StorageProvider.S3]: originalStorageProvider(StorageProvider.S3, "Amazon S3"),
  [StorageProvider.VERCEL_BLOB]: originalStorageProvider(StorageProvider.VERCEL_BLOB, "Vercel Blob"),
  [StorageProvider.CLOUDFLARE_STREAM]: automaticFileProvider(StorageProvider.CLOUDFLARE_STREAM, "Cloudflare Stream", 10),
  [StorageProvider.MUX]: automaticFileProvider(StorageProvider.MUX, "Mux", 20),
  [StorageProvider.YOUTUBE]: embedOnlyProvider(StorageProvider.YOUTUBE, "YouTube", 100),
  [StorageProvider.VIMEO]: embedOnlyProvider(StorageProvider.VIMEO, "Vimeo", 110),
};

/**
 * Future provider extension point:
 * adding Bunny Stream should not require changing strategy logic. Add a
 * `BUNNY_STREAM` value to `StorageProvider`, register its capability metadata
 * here, then add an adapter and opt it into strategy/UI configuration. Domain
 * decisions should keep reading capability flags instead of branching on names.
 */
export function getPlaybackProviderCapabilities(provider: StorageProvider): PlaybackProviderCapability {
  return PROVIDER_CAPABILITIES[provider] ?? unsupportedProvider(provider);
}

export function isPlaybackProvider(provider: StorageProvider): boolean {
  const capabilities = getPlaybackProviderCapabilities(provider);
  return capabilities.kind === "AUTOMATIC_FILE" || capabilities.kind === "EMBED_ONLY";
}

export function isAutomaticFilePlaybackProvider(provider: StorageProvider): boolean {
  return getPlaybackProviderCapabilities(provider).kind === "AUTOMATIC_FILE";
}

export function isEmbedOnlyProvider(provider: StorageProvider): boolean {
  return getPlaybackProviderCapabilities(provider).kind === "EMBED_ONLY";
}

export function canProviderServeTier(provider: StorageProvider, tier: AccessTier): boolean {
  const capabilities = getPlaybackProviderCapabilities(provider);
  if (!isPlaybackProvider(provider)) return false;
  if (tier === AccessTier.PATRON) return capabilities.supportsPatronTier && capabilities.supportsSignedPlayback;
  return capabilities.supportsPublicPlayback;
}

export function assertProviderCanServeTier(provider: StorageProvider, tier: AccessTier): void {
  if (!canProviderServeTier(provider, tier)) {
    throw new Error(`${provider} cannot serve ${tier} video playback`);
  }
}

export function listAutomaticFilePlaybackProviders(): StorageProvider[] {
  return Object.values(StorageProvider).filter(isAutomaticFilePlaybackProvider);
}

export function listConfiguredStrategyCandidateProviders(input: { includeEmbedOnly?: boolean } = {}): StorageProvider[] {
  return Object.values(StorageProvider).filter((provider) => {
    const capabilities = getPlaybackProviderCapabilities(provider);
    if (capabilities.kind === "AUTOMATIC_FILE") return true;
    return Boolean(input.includeEmbedOnly && capabilities.kind === "EMBED_ONLY");
  });
}
