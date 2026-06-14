/**
 * @deprecated Legacy media proxy.
 * Real logic is being moved to lib/modules/media.
 * This file acts as a compatibility layer for R6/R10 migration.
 */

import { logger } from "@/lib/logger";
import { recordAlert, recordMetric } from "@/lib/observability";
import { get } from "@vercel/blob";
import { NextResponse } from 'next/server';
import { MediaPolicy, MediaHostEnv, parseMediaHosts as _parseMediaHosts } from "@/lib/modules/media";
import { checkVideoAccess } from "@/lib/modules/access";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getActorFromAuth } from "@/lib/api/auth";

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
  _prefetchedVideo?:
any // Ignored in modular access
) {
  // R6/R3 delivery: Use modular access check
  const actor = await getActorFromAuth();
  const ctx = createAppContext({ actor });
  const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);

  if (!accessResult.ok) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }

  const decision = accessResult.data;

  if (!decision.hasAccess) {
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
