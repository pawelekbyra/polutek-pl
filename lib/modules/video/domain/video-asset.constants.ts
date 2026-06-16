import { VideoAssetProcessingState, StorageProvider } from '@prisma/client';

export const VIDEO_ASSET_PROCESSING_STATE: Record<string, VideoAssetProcessingState> = {
  PENDING: 'PENDING',
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED'
};

export const VIDEO_PROVIDER: Record<string, StorageProvider> = {
  R2: 'R2',
  S3: 'S3',
  VERCEL_BLOB: 'VERCEL_BLOB',
  CLOUDFLARE_STREAM: 'CLOUDFLARE_STREAM',
  MUX: 'MUX'
};
