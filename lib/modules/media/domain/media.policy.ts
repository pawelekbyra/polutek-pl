import { MediaHostEnv, parseMediaHosts, isBlockedPrivateHostname, isSafeLocalPath } from './media-safety';

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
      // Allows /123456 or /channels/anything/123456
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
}
