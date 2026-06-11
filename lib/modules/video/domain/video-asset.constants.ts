import type { StorageProvider, VideoAssetProcessingState } from "@prisma/client";

export const VIDEO_PROVIDER = {
  R2: "R2",
  S3: "S3",
  VERCEL_BLOB: "VERCEL_BLOB",
  CLOUDFLARE_STREAM: "CLOUDFLARE_STREAM",
  MUX: "MUX",
} as const satisfies Record<string, StorageProvider>;

export const VIDEO_ASSET_PROCESSING_STATE = {
  PENDING: "PENDING",
  UPLOADING: "UPLOADING",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const satisfies Record<string, VideoAssetProcessingState>;
