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
  failureReason?: string | null;
  providerSyncedAt?: Date | null;
  processingStartedAt?: Date | null;
  processingEndedAt?: Date | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  requiresSignedUrl: boolean;
  isPlayable: boolean;
  sourceMode: "CLOUDFLARE_STREAM" | "YOUTUBE" | "LEGACY_PROVIDER_ASSET";
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
  lastSyncAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
  migrationStatus: MigrationStatus;
  publishAfterAssetReady: boolean;
  publishAfterAssetReadyRequestedAt: Date | null;
  publishAfterAssetReadyCompletedAt: Date | null;
  publishAfterAssetReadyError: string | null;
}

export type PublicVideoInput = BaseVideoDto & Record<string, unknown>;

export type AdminVideoAssetInput = {
  id: string;
  videoId: string;
  provider: StorageProvider;
  objectKey: string;
  bucket?: string | null;
  providerAssetId?: string | null;
  providerPlaybackId?: string | null;
  externalVideoId?: string | null;
  externalUrl?: string | null;
  processingState: VideoAssetProcessingState;
  isPrimary: boolean;
  failureReason?: string | null;
  providerSyncedAt?: Date | null;
  processingStartedAt?: Date | null;
  processingEndedAt?: Date | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminVideoInput = PublicVideoInput & {
  videoUrl: string | null;
  status: VideoStatus;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  commentsCount?: number | null;
  _count?: { comments?: number | null } | null;
  asset?: AdminVideoAssetInput | null;
  assets?: AdminVideoAssetInput[] | null;
  publishAfterAssetReady?: boolean | null;
  publishAfterAssetReadyRequestedAt?: Date | null;
  publishAfterAssetReadyCompletedAt?: Date | null;
  publishAfterAssetReadyError?: string | null;
};

export function toPublicVideoDto(video: PublicVideoInput): PublicVideoDto {
  return {
    id: video.id,
    slug: video.slug,
    title: video.title,
    titleEn: video.titleEn,
    description: video.description,
    descriptionEn: video.descriptionEn,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    tier: video.tier,
    views: video.views,
    likesCount: video.likesCount,
    dislikesCount: video.dislikesCount,
    publishedAt: video.publishedAt,
    isMainFeatured: video.isMainFeatured,
    showInSidebar: video.showInSidebar,
    sidebarOrder: video.sidebarOrder,
  };
}

export function toAdminVideoAssetDto(asset: AdminVideoAssetInput | null | undefined): AdminVideoAssetDto | null {
  if (!asset) return null;

  const sourceMode: AdminVideoAssetDto["sourceMode"] =
    asset.provider === "CLOUDFLARE_STREAM" ? "CLOUDFLARE_STREAM"
    : asset.provider === "YOUTUBE" ? "YOUTUBE"
    : "LEGACY_PROVIDER_ASSET";

  const isPlayable = asset.provider === "CLOUDFLARE_STREAM" || asset.provider === "YOUTUBE";

  return {
    id: asset.id,
    videoId: asset.videoId,
    provider: asset.provider,
    objectKey: asset.objectKey,
    bucket: asset.bucket,
    providerAssetId: asset.providerAssetId,
    providerPlaybackId: asset.providerPlaybackId,
    externalVideoId: asset.externalVideoId ?? null,
    externalUrl: asset.externalUrl ?? null,
    status: asset.processingState,
    processingState: asset.processingState,
    isPrimary: asset.isPrimary,
    failureReason: asset.failureReason,
    providerSyncedAt: asset.providerSyncedAt,
    processingStartedAt: asset.processingStartedAt,
    processingEndedAt: asset.processingEndedAt,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    requiresSignedUrl: asset.provider === "CLOUDFLARE_STREAM",
    isPlayable,
    sourceMode,
    durationSeconds: asset.durationSeconds ?? null,
    thumbnailUrl: asset.thumbnailUrl ?? null,
    previewUrl: asset.previewUrl ?? null,
    hlsManifestUrl: asset.hlsManifestUrl ?? null,
    dashManifestUrl: asset.dashManifestUrl ?? null,
    lastSyncAt: asset.providerSyncedAt ?? null,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export function toAdminVideoDto(input: AdminVideoInput | unknown): AdminVideoDto {
  const video = input as AdminVideoInput;
  const rawAssets = video.assets ?? [];
  const asset = video.asset ?? selectPrimaryVideoAsset(rawAssets);
  let migrationStatus: MigrationStatus = "MISSING_SOURCE";

  if (asset) {
    if (asset.provider === "CLOUDFLARE_STREAM") {
      if (asset.processingState === "READY") migrationStatus = "READY";
      else if (asset.processingState === "FAILED") migrationStatus = "FAILED";
      else migrationStatus = "PROCESSING";
    } else {
      migrationStatus = "MIGRATION_REQUIRED";
    }
  } else if (video.videoUrl) {
    migrationStatus = "MIGRATION_REQUIRED";
  }

  return {
    ...toPublicVideoDto(video),
    videoUrl: video.videoUrl,
    status: video.status,
    creatorId: video.creatorId,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    commentsCount: video._count?.comments || video.commentsCount || 0,
    asset: toAdminVideoAssetDto(asset),
    assets: rawAssets
      .map((rawAsset: AdminVideoAssetInput) => toAdminVideoAssetDto(rawAsset))
      .filter((assetDto: AdminVideoAssetDto | null): assetDto is AdminVideoAssetDto => Boolean(assetDto)),
    migrationStatus,
    publishAfterAssetReady: Boolean(video.publishAfterAssetReady),
    publishAfterAssetReadyRequestedAt: video.publishAfterAssetReadyRequestedAt || null,
    publishAfterAssetReadyCompletedAt: video.publishAfterAssetReadyCompletedAt || null,
    publishAfterAssetReadyError: video.publishAfterAssetReadyError || null,
  };
}

export type PlaybackEventType =
  | "PLAYER_READY"
  | "PLAY_REQUESTED"
  | "PLAY_STARTED"
  | "PLAY_PAUSED"
  | "PLAY_RESUMED"
  | "BUFFERING_STARTED"
  | "BUFFERING_ENDED"
  | "SEEKED"
  | "PROGRESS"
  | "HEARTBEAT"
  | "WATCHED_10_SECONDS"
  | "WATCHED_25_PERCENT"
  | "WATCHED_50_PERCENT"
  | "WATCHED_75_PERCENT"
  | "WATCHED_90_PERCENT"
  | "ENDED"
  | "PLAYER_ERROR"
  | "SOURCE_ERROR"
  | "ACCESS_ERROR";

export const PLAYBACK_EVENT_TYPES: PlaybackEventType[] = [
  "PLAYER_READY",
  "PLAY_REQUESTED",
  "PLAY_STARTED",
  "PLAY_PAUSED",
  "PLAY_RESUMED",
  "BUFFERING_STARTED",
  "BUFFERING_ENDED",
  "SEEKED",
  "PROGRESS",
  "HEARTBEAT",
  "WATCHED_10_SECONDS",
  "WATCHED_25_PERCENT",
  "WATCHED_50_PERCENT",
  "WATCHED_75_PERCENT",
  "WATCHED_90_PERCENT",
  "ENDED",
  "PLAYER_ERROR",
  "SOURCE_ERROR",
  "ACCESS_ERROR"
];

export interface RecordPlaybackEventInput {
  videoId: string;
  sessionId?: string;
  type: PlaybackEventType;
  positionMs?: number;
  durationMs?: number;
  bufferedMs?: number;
  volume?: number;
  muted?: boolean;
  fullscreen?: boolean;
  errorCode?: string;
  errorMessage?: string;
  provider?: string;
  sourceKind?: string;
  metadata?: unknown;
  ipHash: string;
  uaHash: string;
  fingerprint: string;
}
