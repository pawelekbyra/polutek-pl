import { logger } from "@/lib/logger";
import { recordAlert, recordMetric } from "@/lib/observability";
import type { AccessVideo } from '@/lib/access/access-policy';
import { get } from "@vercel/blob";
import { AccessPolicy } from "./access/access-policy";
import { NextResponse } from 'next/server';
import { MediaPolicy, MediaHostEnv, parseMediaHosts as _parseMediaHosts } from "@/lib/modules/media";

/** @deprecated Use MediaPolicy.getAllowedMediaHosts */
export function getAllowedMediaHosts(env: MediaHostEnv = process.env) {
    return MediaPolicy.getAllowedMediaHosts(env);
}

/** @deprecated Use parseMediaHosts from @/lib/modules/media */
export function parseMediaHosts(value?: string | null): string[] {
    return _parseMediaHosts(value);
}

/** @deprecated Use MediaPolicy.isAllowedMediaUrl */
export function isAllowedMediaUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    return MediaPolicy.isAllowedMediaUrl(rawUrl, env);
}

/** @deprecated Use MediaPolicy.isAllowedVideoSourceUrl */
export function isAllowedVideoSourceUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    return MediaPolicy.isAllowedVideoSourceUrl(rawUrl, env);
}

/** @deprecated Use MediaPolicy.isAllowedThumbnailUrl */
export function isAllowedThumbnailUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    return MediaPolicy.isAllowedThumbnailUrl(rawUrl, env);
}

/** @deprecated Use MediaPolicy.isAllowedAvatarUrl */
export function isAllowedAvatarUrl(rawUrl?: string | null, env: MediaHostEnv = process.env) {
    return MediaPolicy.isAllowedAvatarUrl(rawUrl, env);
}

/** @deprecated Use MediaPolicy.isAllowedCommentImageUrl */
export function isAllowedCommentImageUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    return MediaPolicy.isAllowedCommentImageUrl(rawUrl, env);
}

export { isSafeLocalPath, isBlockedPrivateHostname } from "@/lib/modules/media";

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
        const blobHosts = new Set(_parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST));
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
  prefetchedVideo?: AccessVideo | null,
  method: string = 'GET'
) {
  const decision = await AccessPolicy.canViewVideo(userId, videoId, prefetchedVideo);

  if (!decision.allowed) {
    recordMetric('media_proxy.access_denied', { videoId, reason: decision.reason || 'unknown', requiredTier: decision.requiredTier || 'unknown' }, { level: 'warn' });
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!MediaPolicy.isAllowedMediaUrl(blobUrl, process.env)) {
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
    logger.info(`[MediaProxy] [${method}] Fetching configured media host: ${targetHost} (Range: ${range?.value || 'none'})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(targetUrl, {
        method,
        headers: range?.value ? { Range: range.value } : {},
        signal: controller.signal,
        redirect: 'manual', // Explicitly handle redirects
    });

    clearTimeout(timeout);

    // Handle redirects manually to re-validate host
    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
        const location = response.headers.get('Location');
        if (!location) {
            return new NextResponse('Redirection without location', { status: 502 });
        }

        // Safety: ensure redirected URL is still allowed
        if (!MediaPolicy.isAllowedMediaUrl(location, process.env)) {
            logger.error(`[MediaProxy] Blocked unauthorized redirect host: ${location}`);
            return new NextResponse('Unauthorized Redirect Host', { status: 403 });
        }

        // For simplicity in this iteration, we don't follow recursively here.
        // We could, but it's safer to just point to the final URL if it's already signed/allowed.
        // Or we could re-call getGatedBlobResponse recursively with a depth limit.
        return new NextResponse('Redirected', { status: 502 }); // Better to fail than to leak or SSRF blindly
    }

    if (!response.ok && response.status !== 206) {
        if (response.status === 416) {
             const size = response.headers.get('Content-Length');
             return new NextResponse('Requested Range Not Satisfiable', {
                status: 416,
                headers: { 'Content-Range': `bytes */${size || '*'}` }
             });
        }

        logger.error(`[MediaProxy] Upstream media error: ${response.status} ${response.statusText}`);
        recordAlert('media_proxy.upstream_error', { videoId, status: response.status });
        return new NextResponse('Error fetching content', { status: response.status });
    }

    const resHeaders = new Headers();
    ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified'].forEach(h => {
        const val = response.headers.get(h);
        if (val) resHeaders.set(h, val);
    });
    resHeaders.set('Cache-Control', 'private, no-store');
    resHeaders.set('Vary', 'Range, Authorization');

    return new NextResponse(method === 'HEAD' ? null : response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[MediaProxy] Upstream timeout for ${videoId}`);
        return new NextResponse('Gateway Timeout', { status: 504 });
    }
    recordAlert('media_proxy.fetch_exception', { videoId });
    logger.error('Error accessing gated media:', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
