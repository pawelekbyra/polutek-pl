import { AccessTier, StorageProvider, VideoAssetProcessingState, VideoStatus } from "@prisma/client";
import { selectPrimaryVideoAsset } from "./video-asset-selection";

export interface BaseVideoDto {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  views: number;
  likesCount: number;
  dislikesCount: number;
  publishedAt: Date | null;
  isMainFeatured: boolean;
  showInSidebar: boolean;
  sidebarOrder: number;
}

export interface PublicVideoDto extends BaseVideoDto {
  videoUrl?: never;
  sourceUrl?: never;
  rawUrl?: never;
  providerUrl?: never;
}

export interface AdminVideoOriginalDto {
  id: string;
  status: string;
  objectKey: string;
  sizeBytes: string | null;
  uploadStartedAt: Date | null;
  uploadCompletedAt: Date | null;
  failureReason: string | null;
}

export interface AdminVideoAssetDto {
  id: string;
  videoId: string;
  provider: StorageProvider;
  objectKey: string;
  bucket?: string | null;
  providerAssetId?: string | null;
  providerPlaybackId?: string | null;
  externalVideoId?: string | null;
  externalUrl?: string | null;
  status: VideoAssetProcessingState;
  processingState: VideoAssetProcessingState;
  isPrimary: boolean;
  isPlayable: boolean;
  failureReason?: string | null;
  providerSyncedAt?: Date | null;
  processingStartedAt?: Date | null;
  processingEndedAt?: Date | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  requiresSignedUrl: boolean;
  sourceMode: "CLOUDFLARE_STREAM" | "MUX" | "YOUTUBE" | "VIMEO" | "LEGACY_PROVIDER_ASSET";
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
  lastSyncAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fallbackPriority: number;
  mirrorSourceOriginalId?: string | null;
  mirrorRequestedAt?: Date | null;
  mirrorCompletedAt?: Date | null;
  mirrorFailureReason?: string | null;
  playbackUrl?: never;
  playbackToken?: never;
  signedUrl?: never;
}

export type MigrationStatus =
  | "READY"
  | "MIGRATION_REQUIRED"
  | "MISSING_SOURCE"
  | "PROCESSING"
  | "FAILED";

export interface AdminVideoDto extends BaseVideoDto {
  videoUrl: string | null;
  status: VideoStatus;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  commentsCount: number;
  asset?: AdminVideoAssetDto | null;
  assets?: AdminVideoAssetDto[];
  original?: AdminVideoOriginalDto | null;
  migrationStatus: MigrationStatus;
  publishAfterAssetReady: boolean;
  publishAfterAssetReadyRequestedAt: Date | null;
  publishAfterAssetReadyCompletedAt: Date | null;
  publishAfterAssetReadyError: string | null;
}
