import { MediaHostEnv, getAllowedMediaHosts, isBlockedPrivateHostname, parseMediaHosts } from "../domain/media-hosts";
import { isAllowedYouTubeUrl, isAllowedVimeoUrl } from "../domain/media-detection";

export function isAllowedMediaUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    let url: URL;

    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;
    if (isBlockedPrivateHostname(url.hostname)) return false;

    return getAllowedMediaHosts(env).has(url.hostname.toLowerCase());
}

export function isAllowedVideoSourceUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;

    if (isAllowedYouTubeUrl(url) || isAllowedVimeoUrl(url)) {
        return true;
    }

    if (isBlockedPrivateHostname(url.hostname)) return false;

    const allowedMediaHosts = getAllowedMediaHosts(env);
    return allowedMediaHosts.has(url.hostname.toLowerCase());
}

export function getAllowedCommentImageHosts(env: MediaHostEnv = process.env) {
    return new Set([
        ...parseMediaHosts(env.ALLOWED_COMMENT_IMAGE_HOSTS),
        ...parseMediaHosts(env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ]);
}

export function getAllowedAvatarHosts(env: MediaHostEnv = process.env) {
    return new Set([
        'img.clerk.com',
        ...parseMediaHosts(env.ALLOWED_AVATAR_HOSTS),
    ]);
}

export function isAllowedCommentImageUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;
    if (isBlockedPrivateHostname(url.hostname)) return false;
    return getAllowedCommentImageHosts(env).has(url.hostname.toLowerCase());
}

export function isAllowedAvatarUrl(rawUrl?: string | null, env: MediaHostEnv = process.env) {
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
    return hostname.endsWith('.clerk.com') || getAllowedAvatarHosts(env).has(hostname);
}

export function isSafeLocalPath(value: string) {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes('\\')) return false;

    let decodedValue = value;
    try {
        decodedValue = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    } catch {
        return false;
    }

    return decodedValue.startsWith('/')
        && !decodedValue.startsWith('//')
        && !decodedValue.split('/').some((segment) => segment === '..');
}

export function isAllowedThumbnailUrl(rawUrl: string, env: MediaHostEnv = process.env) {
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
        ...getAllowedMediaHosts(env),
        ...parseMediaHosts(env.ALLOWED_THUMBNAIL_HOSTS || 'images.unsplash.com,i.ytimg.com,img.clerk.com'),
    ]);

    return allowedHosts.has(url.hostname.toLowerCase());
}
