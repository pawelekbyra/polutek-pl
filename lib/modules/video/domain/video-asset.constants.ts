import { VideoAssetProcessingState, StorageProvider } from '@prisma/client';

export const VIDEO_ASSET_PROCESSING_STATE: Record<string, VideoAssetProcessingState> = {
  PENDING: 'PENDING',
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED'
};

/**
 * Only SELF_HLS (our own HLS, CLAUDE.md 4.17) is a live video source. The other
 * StorageProvider enum values (R2, S3, VERCEL_BLOB, CLOUDFLARE_STREAM, MUX, YOUTUBE,
 * VIMEO) are legacy: kept in the DB enum so migration history stays intact, never
 * written, never played.
 */
export const VIDEO_PROVIDER: Record<string, StorageProvider> = {
  SELF_HLS: 'SELF_HLS',
};
