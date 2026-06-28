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
  VIMEO: 'VIMEO',
};

/** Providers that can serve as the active primary playback source. */
export const PLAYABLE_PROVIDERS: StorageProvider[] = ['CLOUDFLARE_STREAM', 'MUX', 'YOUTUBE', 'VIMEO'];

/** Embed-only providers that cannot be used for PATRON-tier videos (no private playback). */
export const EMBED_ONLY_PROVIDERS: StorageProvider[] = ['YOUTUBE', 'VIMEO'];

/** Providers that require upload + webhook processing (async READY flow). */
export const ASYNC_UPLOAD_PROVIDERS: StorageProvider[] = ['CLOUDFLARE_STREAM', 'MUX'];

/** Extract a Vimeo video ID from common URL formats. Returns null if not a valid Vimeo URL. */
export function extractVimeoVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'vimeo.com' || u.hostname === 'www.vimeo.com') {
      const match = u.pathname.match(/^\/(\d+)/);
      return match ? match[1] : null;
    }
    if (u.hostname === 'player.vimeo.com') {
      const match = u.pathname.match(/^\/video\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
    return match ? match[1] : null;
  }
}

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

/** Map Mux asset status to internal processing state. */
export function mapMuxStateToProcessingState(muxStatus: string): VideoAssetProcessingState {
  switch (muxStatus) {
    case 'preparing':
      return VIDEO_ASSET_PROCESSING_STATE.PROCESSING;
    case 'ready':
      return VIDEO_ASSET_PROCESSING_STATE.READY;
    case 'errored':
      return VIDEO_ASSET_PROCESSING_STATE.FAILED;
    default:
      return VIDEO_ASSET_PROCESSING_STATE.PROCESSING;
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
