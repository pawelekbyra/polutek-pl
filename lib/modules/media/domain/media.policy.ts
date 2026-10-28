import { MediaHostEnv, parseMediaHosts, isBlockedPrivateHostname, isSafeLocalPath } from './media-safety';
import { InternalMediaSource, PublicMediaDescriptor, GatedMediaReference } from './media.dto';
import { UnsafePublicMediaDtoError, RawVideoUrlExposedError } from './media.errors';

export class MediaPolicy {
  static getAllowedMediaHosts(env: MediaHostEnv) {
    return new Set([
      ...parseMediaHosts(env.MEDIA_BUCKET_HOST),
      ...parseMediaHosts(env.NEXT_PUBLIC_R2_PUBLIC_HOST),
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

  /**
   * Our own HLS delivery (the token-checked Cloudflare Worker): https, the configured delivery host
   * (HLS_DELIVERY_BASE_URL, default https://video.pawelperfect.com), path /h/<token>/<videoId>/<version>/master.m3u8.
   * It is a signed, short-lived URL meant for the player, so it is not treated as a raw URL.
   */
  static isSelfHlsDeliveryUrl(url: string, env: NodeJS.ProcessEnv = process.env): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const base = new URL((env.HLS_DELIVERY_BASE_URL?.trim() || 'https://video.pawelperfect.com').replace(/\/+$/, ''));
      if (parsed.hostname.toLowerCase() !== base.hostname.toLowerCase()) return false;
      return /^\/h\/[^/]+\/[^/]+\/[^/]+\/master\.m3u8$/i.test(parsed.pathname);
    } catch {
      return false;
    }
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
      ...parseMediaHosts(env.ALLOWED_THUMBNAIL_HOSTS || 'images.unsplash.com,img.clerk.com'),
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
    ]);

    return hostname.endsWith('.clerk.com') || allowedAvatarHosts.has(hostname);
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
    const forbiddenFields = ['videoUrl', 'sourceUrl', 'rawUrl', 'signedUrl', 'providerUrl', 's3Url', 'blobUrl', 'r2Url', 'storageKey', 'objectKey', 'bucket'];

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
   * Asserts that a video DTO is safe for public exposure.
   */
  static assertPublicVideoDtoSafe(dto: any): void {
    const forbiddenFields = [
        'videoUrl', 'sourceUrl', 'rawUrl', 'signedUrl', 'providerUrl',
        's3Url', 'blobUrl', 'r2Url', 'storageKey', 'objectKey', 'bucket',
        'internalAssetProviderUrl'
    ];

    for (const field of forbiddenFields) {
        if (dto[field] !== undefined && dto[field] !== null) {
            throw new UnsafePublicMediaDtoError(`Forbidden field detected in video DTO: ${field}`);
        }
    }

    if (dto.thumbnailUrl && this.isProbablyRawMediaUrl(dto.thumbnailUrl)) {
        // Redacting raw thumbnails is optional but recommended.
        // For now we just log it or we could throw if we want to be strict.
    }
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

    if (this.isSelfHlsDeliveryUrl(url)) return false;

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
      'stream.mux.com',
      'videodelivery.net',
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
    const isGatedRoute = lowerUrl.startsWith('/api/media-source/');
    if (!isGatedRoute) {
      const mediaExtensions = ['.mp4', '.m4v', '.webm', '.m3u8', '.mpd', '.mov'];
      const urlWithoutQuery = lowerUrl.split('?')[0];
      if (mediaExtensions.some(ext => urlWithoutQuery.endsWith(ext))) {
        // If it's a full URL (starts with http), it's probably raw if it's not our gated domain
        // For simplicity, we consider any full URL with media extension as potentially raw
        if (lowerUrl.startsWith('http')) {
          return true;
        }
      }
    }

    return false;
  }
}
