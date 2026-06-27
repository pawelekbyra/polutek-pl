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
  MUX: 'MUX',
  YOUTUBE: 'YOUTUBE',
};

/** Providers that can serve as the active primary playback source. */
export const PLAYABLE_PROVIDERS: StorageProvider[] = ['CLOUDFLARE_STREAM', 'YOUTUBE'];

/** Extract a YouTube video ID from common URL formats. Returns null if not a valid YouTube URL. */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0];
      return id || null;
    }
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const embedMatch = u.pathname.match(/^\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function mapCloudflareStateToProcessingState(cfState: string): VideoAssetProcessingState {
  switch (cfState) {
    case "pendingupload":
    case "downloading":
      return VIDEO_ASSET_PROCESSING_STATE.UPLOADING;
    case "queued":
    case "processing":
      return VIDEO_ASSET_PROCESSING_STATE.PROCESSING;
    case "ready":
      return VIDEO_ASSET_PROCESSING_STATE.READY;
    case "error":
    case "failed":
      return VIDEO_ASSET_PROCESSING_STATE.FAILED;
    default:
      return VIDEO_ASSET_PROCESSING_STATE.PROCESSING;
  }
}
