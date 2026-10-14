import type { AccessTier, StorageProvider, VideoAssetProcessingState, VideoStatus } from "@prisma/client";
import { selectPrimaryVideoAsset } from "./video-asset-selection";
import { assetSizeToNumber } from "./asset-size";
import { resolvePublicThumbnailSrc } from "@/lib/modules/media";
import { effectivePublishedAt, toPremiereDate } from "./premiere";
import { toVideoAccessTier } from "@/lib/access-tier";

export interface BaseVideoDto {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string;
  subtitleUrlPl?: string | null;
  subtitleUrlEn?: string | null;
  duration?: string | null;
  tier: AccessTier;
  views: number;
  likesCount: number;
  dislikesCount: number;
  publishedAt: Date | null;
  /** Scheduled premiere (see CLAUDE.md "Premieres"). Public DTOs carry it as an ISO string. */
  premiereAt?: Date | string | null;
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
  status: VideoAssetProcessingState;
  processingState: VideoAssetProcessingState;
  isPrimary: boolean;
  isPlayable: boolean;
  failureReason?: string | null;
  processingEndedAt?: Date | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  requiresSignedUrl: boolean;
  sourceMode: "SELF_HLS" | "LEGACY_PROVIDER_ASSET";
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
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
  /** Fundraising goal (admin only; the public DTO carries just the progress fraction). */
  fundraisingGoalMinor: number | null;
  fundraisingGoalCurrency: string | null;
  fundraisingStartAt: Date | null;
  /** Hand-set bar fill 0..100 (wins over the goal), null = off. */
  fundraisingManualPercent: number | null;
  /** Creator metadata (Studio "Więcej opcji"). */
  tags: string[];
  category: string | null;
  commentsMode: "ON" | "HELD" | "OFF";
  /** Declared by the creator: adult content, signed-in viewers only (same effect as moderation AGE_RESTRICTED). */
  isAdult: boolean;
}

export type PublicVideoInput = BaseVideoDto & Record<string, unknown>;

export type AdminVideoAssetInput = {
  id: string;
  videoId: string;
  provider: StorageProvider;
  objectKey: string;
  bucket?: string | null;
  processingState: VideoAssetProcessingState;
  isPrimary: boolean;
  failureReason?: string | null;
  processingEndedAt?: Date | null;
  mimeType?: string | null;
  sizeBytes?: bigint | number | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminVideoOriginalInput = {
  id: string;
  status: string;
  objectKey: string;
  sizeBytes?: bigint | null;
  uploadStartedAt?: Date | null;
  uploadCompletedAt?: Date | null;
  failureReason?: string | null;
};

export type AdminVideoInput = PublicVideoInput & {
  status: VideoStatus;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  commentsCount?: number | null;
  _count?: { comments?: number | null } | null;
  asset?: AdminVideoAssetInput | null;
  assets?: AdminVideoAssetInput[] | null;
  original?: AdminVideoOriginalInput | null;
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
    // Never the raw stored value (it may be a private Blob/R2 URL). A published
    // video with a synced public R2 copy gets that URL; everything else goes
    // through the thumbnail proxy, which also resolves the global fallback.
    thumbnailUrl: resolvePublicThumbnailSrc({
      id: video.id,
      status: video.status as string | undefined,
      thumbnailUrl: video.thumbnailUrl,
      thumbnailPublicUrl: video.thumbnailPublicUrl as string | null | undefined,
    }, process.env),
    subtitleUrlPl: video.subtitleUrlPl ?? null,
    subtitleUrlEn: video.subtitleUrlEn ?? null,
    duration: video.duration,
    tier: toVideoAccessTier(video.tier),
    views: video.views,
    likesCount: video.likesCount,
    dislikesCount: video.dislikesCount,
    // "Published" as viewers see it: the premiere time once one is scheduled.
    publishedAt: effectivePublishedAt(video),
    premiereAt: toPremiereDate(video.premiereAt)?.toISOString() ?? null,
    isMainFeatured: video.isMainFeatured,
    showInSidebar: video.showInSidebar,
    sidebarOrder: video.sidebarOrder,
  };
}

function resolveSourceMode(provider: StorageProvider): AdminVideoAssetDto["sourceMode"] {
  return provider === "SELF_HLS" ? "SELF_HLS" : "LEGACY_PROVIDER_ASSET";
}

function resolveIsPlayable(provider: StorageProvider, processingState: VideoAssetProcessingState): boolean {
  return provider === "SELF_HLS" && processingState === "READY";
}

export function toAdminVideoOriginalDto(original: AdminVideoOriginalInput | null | undefined): AdminVideoOriginalDto | null {
  if (!original) return null;
  return {
    id: original.id,
    status: original.status,
    objectKey: original.objectKey,
    sizeBytes: original.sizeBytes != null ? original.sizeBytes.toString() : null,
    uploadStartedAt: original.uploadStartedAt ?? null,
    uploadCompletedAt: original.uploadCompletedAt ?? null,
    failureReason: original.failureReason ?? null,
  };
}

export function toAdminVideoAssetDto(asset: AdminVideoAssetInput | null | undefined): AdminVideoAssetDto | null {
  if (!asset) return null;

  return {
    id: asset.id,
    videoId: asset.videoId,
    provider: asset.provider,
    objectKey: asset.objectKey,
    bucket: asset.bucket,
    status: asset.processingState,
    processingState: asset.processingState,
    isPrimary: asset.isPrimary,
    isPlayable: resolveIsPlayable(asset.provider, asset.processingState),
    failureReason: asset.failureReason,
    processingEndedAt: asset.processingEndedAt,
    mimeType: asset.mimeType,
    sizeBytes: assetSizeToNumber(asset.sizeBytes),
    requiresSignedUrl: asset.provider === "SELF_HLS",
    sourceMode: resolveSourceMode(asset.provider),
    durationSeconds: asset.durationSeconds ?? null,
    thumbnailUrl: asset.thumbnailUrl ?? null,
    previewUrl: asset.previewUrl ?? null,
    hlsManifestUrl: asset.hlsManifestUrl ?? null,
    dashManifestUrl: asset.dashManifestUrl ?? null,
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
    if (asset.provider === "SELF_HLS") {
      if (asset.processingState === "READY") migrationStatus = "READY";
      else if (asset.processingState === "FAILED") migrationStatus = "FAILED";
      else migrationStatus = "PROCESSING";
    } else {
      // A leftover asset of a provider we no longer support: the video must be uploaded again.
      migrationStatus = "MIGRATION_REQUIRED";
    }
  }

  return {
    ...toPublicVideoDto(video),
    // Admins see the stored publish time, not the viewer-facing effective one.
    publishedAt: video.publishedAt ?? null,
    status: video.status,
    creatorId: video.creatorId,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    commentsCount: video._count?.comments || video.commentsCount || 0,
    asset: toAdminVideoAssetDto(asset),
    assets: rawAssets
      .map((rawAsset: AdminVideoAssetInput) => toAdminVideoAssetDto(rawAsset))
      .filter((assetDto: AdminVideoAssetDto | null): assetDto is AdminVideoAssetDto => Boolean(assetDto)),
    original: toAdminVideoOriginalDto(video.original),
    migrationStatus,
    publishAfterAssetReady: Boolean(video.publishAfterAssetReady),
    publishAfterAssetReadyRequestedAt: video.publishAfterAssetReadyRequestedAt || null,
    publishAfterAssetReadyCompletedAt: video.publishAfterAssetReadyCompletedAt || null,
    publishAfterAssetReadyError: video.publishAfterAssetReadyError || null,
    fundraisingGoalMinor: typeof video.fundraisingGoalMinor === "number" ? video.fundraisingGoalMinor : null,
    fundraisingGoalCurrency: typeof video.fundraisingGoalCurrency === "string" ? video.fundraisingGoalCurrency : null,
    fundraisingStartAt: video.fundraisingStartAt instanceof Date ? video.fundraisingStartAt : null,
    fundraisingManualPercent: typeof video.fundraisingManualPercent === "number" ? video.fundraisingManualPercent : null,
    tags: Array.isArray(video.tags) ? (video.tags as unknown[]).filter((tag): tag is string => typeof tag === "string") : [],
    category: typeof video.category === "string" ? video.category : null,
    commentsMode: video.commentsMode === "HELD" || video.commentsMode === "OFF" ? video.commentsMode : "ON",
    isAdult: video.isAdult === true,
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

/** How often the player sends HEARTBEAT while playing (the plan tells the player this value). */
export const PLAYBACK_HEARTBEAT_INTERVAL_SECONDS = 60;

/**
 * Most watch time one HEARTBEAT/PAUSE/END may add: one interval plus slack for late timers.
 * A longer gap means the player was paused or the tab slept, which is not watch time.
 */
export const PLAYBACK_MAX_WATCH_INCREMENT_MS = (PLAYBACK_HEARTBEAT_INTERVAL_SECONDS + 30) * 1000;

/** A playback session accepts events (and can be kept on a token renewal) for this long. */
export const PLAYBACK_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
