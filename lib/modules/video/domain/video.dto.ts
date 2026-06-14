import { AccessTier, StorageProvider, VideoAssetProcessingState, VideoStatus } from "@prisma/client";

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
  processingState: VideoAssetProcessingState;
  isPrimary: boolean;
  failureReason?: string | null;
  providerSyncedAt?: Date | null;
  processingStartedAt?: Date | null;
  processingEndedAt?: Date | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
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
  videoUrl: string;
  status: VideoStatus;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  commentsCount: number;
  asset?: AdminVideoAssetDto | null;
  migrationStatus: MigrationStatus;
}

export function toPublicVideoDto(video:
any): PublicVideoDto {
  const dto = {
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

  // Strip any accidental sensitive fields if they exist in the input object
  const forbidden = ['videoUrl', 'sourceUrl', 'rawUrl', 'signedUrl', 'providerUrl', 's3Url', 'blobUrl'];
  for (const field of forbidden) {
      if (field in dto) delete (dto as
any)[field];
  }

  return dto as PublicVideoDto;
}

export function toAdminVideoAssetDto(asset:
any): AdminVideoAssetDto | null {
  if (!asset) return null;

  return {
    id: asset.id,
    videoId: asset.videoId,
    provider: asset.provider,
    objectKey: asset.objectKey,
    bucket: asset.bucket,
    providerAssetId: asset.providerAssetId,
    providerPlaybackId: asset.providerPlaybackId,
    processingState: asset.processingState,
    isPrimary: asset.isPrimary,
    failureReason: asset.failureReason,
    providerSyncedAt: asset.providerSyncedAt,
    processingStartedAt: asset.processingStartedAt,
    processingEndedAt: asset.processingEndedAt,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export function toAdminVideoDto(video:
any): AdminVideoDto {
  const asset = video.asset;
  let migrationStatus: MigrationStatus = "MISSING_SOURCE";

  if (asset) {
    if (asset.provider === "CLOUDFLARE_STREAM") {
      if (asset.processingState === "READY") migrationStatus = "READY";
      else if (asset.processingState === "FAILED") migrationStatus = "FAILED";
      else migrationStatus = "PROCESSING";
    } else {
      // R2, S3, Vercel Blob
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
    migrationStatus,
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
  metadata?:
any;
  ipHash: string;
  uaHash: string;
  fingerprint: string;
}
