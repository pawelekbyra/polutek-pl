import { logger } from "@/lib/logger";
import { recordAlert, recordMetric } from "@/lib/observability";
import type { AccessVideo } from '@/lib/access/access-policy';
import { get } from "@vercel/blob";
import { AccessPolicy } from "./access/access-policy";
import { NextResponse } from 'next/server';

type MediaHostEnv = Record<string, string | undefined>;

export function parseMediaHosts(value?: string | null): string[] {
    if (!value) return [];

    return value
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean)
        .map((host) => {
            try {
                return new URL(host).hostname.toLowerCase();
            } catch {
                return host.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
            }
        })
        .filter(Boolean);
}

export function getAllowedMediaHosts(env: MediaHostEnv = process.env) {
    return new Set([
        ...parseMediaHosts(env.MEDIA_BUCKET_HOST),
        ...parseMediaHosts(env.NEXT_PUBLIC_R2_PUBLIC_HOST),
        ...parseMediaHosts(env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
        ...parseMediaHosts(env.ALLOWED_MEDIA_HOSTS),
    ]);
}

function normalizeHostname(hostname: string) {
    return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isPrivateIpv4(hostname: string) {
    const parts = hostname.split('.');
    if (parts.length !== 4) return false;

    const octets = parts.map((part) => {
        if (!/^\d{1,3}$/.test(part)) return Number.NaN;
        return Number(part);
    });

    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return false;
    }

    const [first, second] = octets;
    return first === 10
        || first === 127
        || first === 0
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168);
}

function isPrivateIpv6(hostname: string) {
    const host = normalizeHostname(hostname);
    if (!host.includes(':')) return false;

    return host === '::1'
        || host === '0:0:0:0:0:0:0:1'
        || host.startsWith('fc')
        || host.startsWith('fd')
        || host.startsWith('fe80:');
}

export function isBlockedPrivateHostname(hostname: string) {
    const host = normalizeHostname(hostname);
    return host === 'localhost'
        || host.endsWith('.localhost')
        || isPrivateIpv4(host)
        || isPrivateIpv6(host);
}

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

function isAllowedYouTubeUrl(url: URL) {
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

function isAllowedVimeoUrl(url: URL) {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$|^$/g, '') || '/';

    if (hostname === 'vimeo.com') {
        return /^\/\d+$/.test(pathname) || /\/\d+$/.test(pathname);
    }

    if (hostname === 'player.vimeo.com') {
        return /^\/video\/\d+$/.test(pathname);
    }

    return false;
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

    // Direct files and streaming manifests must be served from explicitly configured media hosts.
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

    // Miniaturki mogą pochodzić z hostów mediów lub zaufanych hostów obrazków
    const allowedHosts = new Set([
        ...getAllowedMediaHosts(env),
        ...parseMediaHosts(env.ALLOWED_THUMBNAIL_HOSTS || 'images.unsplash.com,i.ytimg.com,img.clerk.com'),
    ]);

    return allowedHosts.has(url.hostname.toLowerCase());
}

function getValidatedRange(headers?: Headers) {
    const range = headers?.get('range');
    if (!range) return null;

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) return { error: true as const };

    const [, startRaw, endRaw] = match;
    if (!startRaw && !endRaw) return { error: true as const };

    if (startRaw && endRaw && Number(startRaw) > Number(endRaw)) {
        return { error: true as const };
    }

    return { error: false as const, value: `bytes=${startRaw}-${endRaw}` };
}

function isConfiguredVercelBlobUrl(rawUrl: string) {
    try {
        const hostname = new URL(rawUrl).hostname.toLowerCase();
        const blobHosts = new Set(parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST));
        return blobHosts.has(hostname);
    } catch {
        return false;
    }
}

/**
 * Serves a private Vercel Blob or external file as a gated stream.
 */
export async function getGatedBlobResponse(
  userId: string | null,
  videoId: string,
  blobUrl: string,
  headers?: Headers,
  prefetchedVideo?: AccessVideo | null
) {
  const decision = await AccessPolicy.canViewVideo(userId, videoId, prefetchedVideo);

  if (!decision.allowed) {
    recordMetric('media_proxy.access_denied', { videoId, reason: decision.reason || 'unknown', requiredTier: decision.requiredTier || 'unknown' }, { level: 'warn' });
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!isAllowedMediaUrl(blobUrl)) {
    try {
      const hostname = new URL(blobUrl).hostname.toLowerCase();
      logger.error(`[MediaProxy] Blocked unauthorized media host: ${hostname}`);
      recordAlert('media_proxy.host_blocked', { videoId, host: hostname });
    } catch {
      logger.error('[MediaProxy] Blocked malformed media URL.');
      recordAlert('media_proxy.malformed_url', { videoId });
    }
    return new NextResponse('Unauthorized Media Host', { status: 403 });
  }

  const range = getValidatedRange(headers);
  if (range?.error) {
    recordMetric('media_proxy.invalid_range', { videoId }, { level: 'warn' });
    return new NextResponse('Invalid Range header', { status: 416 });
  }

  try {
    const isVercelBlob = isConfiguredVercelBlobUrl(blobUrl);
    let targetUrl = blobUrl;

    if (isVercelBlob) {
        const result = await get(blobUrl, { access: 'private' });
        if (!result) {
            recordMetric('media_proxy.blob_not_found', { videoId }, { level: 'warn' });
            return new NextResponse('Not found', { status: 404 });
        }
        targetUrl = result.blob.url;
    }

    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    logger.info(`[MediaProxy] Fetching configured media host: ${targetHost} (Range: ${range?.value || 'none'})`);

    const response = await fetch(targetUrl, {
        headers: range?.value ? { Range: range.value } : {}
    });

    if (!response.ok && response.status !== 206) {
        logger.error(`[MediaProxy] Upstream media error: ${response.status} ${response.statusText} from ${targetHost}`);
        recordAlert('media_proxy.upstream_error', { videoId, status: response.status, host: targetHost });
      return new NextResponse('Error fetching content', { status: response.status });
    }

    const resHeaders = new Headers();
    ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'].forEach(h => {
        const val = response.headers.get(h);
        if (val) resHeaders.set(h, val);
    });
    resHeaders.set('Cache-Control', 'private, no-store');

    return new NextResponse(response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error) {
    recordAlert('media_proxy.fetch_exception', { videoId });
    logger.error('Error accessing gated media:', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
