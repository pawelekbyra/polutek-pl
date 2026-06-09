import { MediaHostEnv, parseMediaHosts, isBlockedPrivateHostname, isSafeLocalPath } from './media-safety';
import { InternalMediaSource, PublicMediaDescriptor, GatedMediaReference } from './media.dto';
import { UnsafePublicMediaDtoError, RawVideoUrlExposedError } from './media.errors';

export class MediaPolicy {
  static getAllowedMediaHosts(env: MediaHostEnv) {
    return new Set([
      ...parseMediaHosts(env.MEDIA_BUCKET_HOST),
      ...parseMediaHosts(env.NEXT_PUBLIC_R2_PUBLIC_HOST),
      ...parseMediaHosts(env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
      ...parseMediaHosts(env.ALLOWED_MEDIA_HOSTS),
    ]);
  }

  static isAllowedMediaUrl(rawUrl: string, env: MediaHostEnv) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }

    if (url.protocol !== 'https:') return false;
    if (isBlockedPrivateHostname(url.hostname)) return false;

    return this.getAllowedMediaHosts(env).has(url.hostname.toLowerCase());
  }

  static isAllowedVideoSourceUrl(rawUrl: string, env: MediaHostEnv) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }

    if (url.protocol !== 'https:') return false;

    if (this.isAllowedYouTubeUrl(url) || this.isAllowedVimeoUrl(url)) {
      return true;
    }

    if (isBlockedPrivateHostname(url.hostname)) return false;

    return this.getAllowedMediaHosts(env).has(url.hostname.toLowerCase());
  }

  private static isAllowedYouTubeUrl(url: URL) {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$|^$/g, '') || '/';

    if (hostname === 'youtu.be') {
      return /^\/[A-Za-z0-9_-]+$/.test(pathname);
    }

    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(hostname)) {
      return false;
    }

    if (pathname === '/watch') {
      return !!url.searchParams.get('v');
    }

    return /^\/(shorts|live|embed)\/[A-Za-z0-9_-]+$/.test(pathname);
  }

  private static isAllowedVimeoUrl(url: URL) {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$|^$/g, '') || '/';

    if (hostname === 'vimeo.com') {
      return /^\/\d+$/.test(pathname) || /\/\d+$/.test(pathname) || /\/\d+$/.test(pathname.split('/').pop() || '');
    }

    if (hostname === 'player.vimeo.com') {
      return /^\/video\/\d+$/.test(pathname);
    }

    return false;
  }

  static isAllowedThumbnailUrl(rawUrl: string, env: MediaHostEnv) {
    if (isSafeLocalPath(rawUrl)) return true;
    if (rawUrl.startsWith("//")) return false;

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }

    if (url.protocol !== 'https:') return false;
    if (isBlockedPrivateHostname(url.hostname)) return false;

    const allowedHosts = new Set([
      ...this.getAllowedMediaHosts(env),
      ...parseMediaHosts(env.ALLOWED_THUMBNAIL_HOSTS || 'images.unsplash.com,i.ytimg.com,img.clerk.com'),
    ]);

    return allowedHosts.has(url.hostname.toLowerCase());
  }

  static isAllowedAvatarUrl(rawUrl: string | null | undefined, env: MediaHostEnv) {
    if (!rawUrl) return false;

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }

    if (url.protocol !== 'https:') return false;
    if (isBlockedPrivateHostname(url.hostname)) return false;

    const hostname = url.hostname.toLowerCase();
    const allowedAvatarHosts = new Set([
      ...parseMediaHosts(env.ALLOWED_AVATAR_HOSTS),
      ...parseMediaHosts(env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ]);

    return hostname.endsWith('.clerk.com') || allowedAvatarHosts.has(hostname);
  }

  static isAllowedCommentImageUrl(rawUrl: string, env: MediaHostEnv) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }

    if (url.protocol !== 'https:') return false;
    if (isBlockedPrivateHostname(url.hostname)) return false;

    const allowedCommentImageHosts = new Set([
      ...parseMediaHosts(env.ALLOWED_COMMENT_IMAGE_HOSTS),
      ...parseMediaHosts(env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ]);

    return allowedCommentImageHosts.has(url.hostname.toLowerCase());
  }

  static visiblePublishedAtFilter(now: Date) {
    return {
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    };
  }

  /**
   * Asserts that a PublicMediaDescriptor is safe and does not leak raw URLs.
   */
  static assertPublicMediaDescriptorSafe(descriptor: PublicMediaDescriptor): void {
    const forbiddenFields = ['videoUrl', 'sourceUrl', 'rawUrl', 'signedUrl', 'providerUrl', 's3Url', 'blobUrl'];

    for (const field of forbiddenFields) {
      if ((descriptor as any)[field]) {
        throw new UnsafePublicMediaDtoError(`Forbidden field detected: ${field}`);
      }
    }

    if (this.isProbablyRawMediaUrl(descriptor.playbackUrl)) {
      throw new RawVideoUrlExposedError();
    }
  }

  /**
   * Redacts an InternalMediaSource into a safe PublicMediaDescriptor.
   */
  static redactInternalMediaSource(source: InternalMediaSource): PublicMediaDescriptor {
    return {
      videoId: source.videoId,
      playbackUrl: `/api/media/${source.videoId}`,
    };
  }

  /**
   * Creates a GatedMediaReference for a video.
   */
  static createGatedMediaReference(videoId: string): GatedMediaReference {
    return {
      videoId,
      endpoint: `/api/media-source/${videoId}`,
      requiresAccessCheck: true,
    };
  }

  /**
   * Detects if a URL looks like a raw/private storage URL.
   */
  static isProbablyRawMediaUrl(url: string): boolean {
    if (!url) return false;

    const lowerUrl = url.toLowerCase();

    // Direct S3/Blob storage patterns
    const rawPatterns = [
      '.s3.',
      'amazonaws.com',
      '.blob.core.windows.net',
      '.digitaloceanspaces.com',
      '.backblazeb2.com',
      '.r2.cloudflarestorage.com',
      'storage.googleapis.com',
      'supabase.co/storage',
    ];

    if (rawPatterns.some(pattern => lowerUrl.includes(pattern))) {
      return true;
    }

    // URLs with signatures/tokens
    const signatureParams = ['X-Amz-Signature', 'token=', 'sig=', 'signature=', 'key='];
    if (signatureParams.some(param => lowerUrl.includes(param.toLowerCase()))) {
      return true;
    }

    // Direct media extensions but NOT on our gated routes
    const isGatedRoute = lowerUrl.startsWith('/api/media/') || lowerUrl.startsWith('/api/media-source/');
    if (!isGatedRoute) {
      const mediaExtensions = ['.mp4', '.m4v', '.webm', '.m3u8', '.mpd', '.mov'];
      const urlWithoutQuery = lowerUrl.split('?')[0];
      if (mediaExtensions.some(ext => urlWithoutQuery.endsWith(ext))) {
        // If it's a full URL (starts with http), it's probably raw if it's not our gated domain
        // For simplicity, we consider any full URL with media extension as potentially raw
        // unless it's handled by a specific provider (YouTube/Vimeo) which is checked elsewhere.
        if (lowerUrl.startsWith('http')) {
          return true;
        }
      }
    }

    return false;
  }
}
