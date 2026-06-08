/**
 * @deprecated Use @/lib/modules/media instead.
 * This file is a compatibility adapter for stage R3/R10.
 */
import {
    getAllowedMediaHosts as newGetAllowedMediaHosts,
    isBlockedPrivateHostname as newIsBlockedPrivateHostname,
    isAllowedMediaUrl as newIsAllowedMediaUrl,
    isSafeLocalPath as newIsSafeLocalPath,
    isAllowedVideoSourceUrl as newIsAllowedVideoSourceUrl,
    getAllowedCommentImageHosts as newGetAllowedCommentImageHosts,
    getAllowedAvatarHosts as newGetAllowedAvatarHosts,
    isAllowedCommentImageUrl as newIsAllowedCommentImageUrl,
    isAllowedAvatarUrl as newIsAllowedAvatarUrl,
    isAllowedThumbnailUrl as newIsAllowedThumbnailUrl,
    parseMediaHosts as newParseMediaHosts
} from "@/lib/modules/media";
import { NextResponse } from 'next/server';
import { AccessPolicy } from '@/lib/access/access-policy';
import { recordMetric, recordAlert } from '@/lib/observability';
import { logger } from '@/lib/logger';
import { get } from '@vercel/blob';

export const getAllowedMediaHosts = newGetAllowedMediaHosts;
export const isBlockedPrivateHostname = newIsBlockedPrivateHostname;
export const isAllowedMediaUrl = newIsAllowedMediaUrl;
export const isSafeLocalPath = newIsSafeLocalPath;
export const isAllowedVideoSourceUrl = newIsAllowedVideoSourceUrl;
export const getAllowedCommentImageHosts = newGetAllowedCommentImageHosts;
export const getAllowedAvatarHosts = newGetAllowedAvatarHosts;
export const isAllowedCommentImageUrl = newIsAllowedCommentImageUrl;
export const isAllowedAvatarUrl = newIsAllowedAvatarUrl;
export const isAllowedThumbnailUrl = newIsAllowedThumbnailUrl;
export const parseMediaHosts = newParseMediaHosts;

export type MediaHostEnv = import("@/lib/modules/media").MediaHostEnv;

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
        const blobHosts = new Set(newParseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST));
        return blobHosts.has(hostname);
    } catch {
        return false;
    }
}

/**
 * Serves a private Vercel Blob or external file as a gated stream.
 * @deprecated Move to R6 Video module.
 */
export async function getGatedBlobResponse(
  userId: string | null,
  videoId: string,
  blobUrl: string,
  headers?: Headers,
  prefetchedVideo?: any | null
) {
  const decision = await AccessPolicy.canViewVideo(userId, videoId, prefetchedVideo);

  if (!decision.allowed) {
    recordMetric('media_proxy.access_denied', { videoId, reason: decision.reason || 'unknown', requiredTier: decision.requiredTier || 'unknown' }, { level: 'warn' });
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!newIsAllowedMediaUrl(blobUrl)) {
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
