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

export function isAllowedMediaUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    let url: URL;

    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;

    return getAllowedMediaHosts(env).has(url.hostname.toLowerCase());
}

export function isSafeLocalPath(value: string) {
    return value.startsWith("/") && !value.startsWith("//") && !value.includes("..");
}

export function isAllowedThumbnailUrl(rawUrl: string, env: MediaHostEnv = process.env) {
    if (isSafeLocalPath(rawUrl)) return true;

    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;

    // Miniaturki mogą pochodzić z hostów mediów lub zaufanych hostów obrazków
    const allowedHosts = new Set([
        ...getAllowedMediaHosts(env),
        ...parseMediaHosts(env.ALLOWED_THUMBNAIL_HOSTS || 'images.unsplash.com,i.ytimg.com'),
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
  prefetchedVideo?: any // Can be AccessVideo
) {
  const decision = await AccessPolicy.canViewVideo(userId, videoId, prefetchedVideo);

  if (!decision.allowed) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!isAllowedMediaUrl(blobUrl)) {
    try {
      const hostname = new URL(blobUrl).hostname.toLowerCase();
      console.error(`[MediaProxy] Blocked unauthorized media host: ${hostname}`);
    } catch {
      console.error('[MediaProxy] Blocked malformed media URL.');
    }
    return new NextResponse('Unauthorized Media Host', { status: 403 });
  }

  const range = getValidatedRange(headers);
  if (range?.error) {
    return new NextResponse('Invalid Range header', { status: 416 });
  }

  try {
    const isVercelBlob = isConfiguredVercelBlobUrl(blobUrl);
    let targetUrl = blobUrl;

    if (isVercelBlob) {
        const result = await get(blobUrl, { access: 'private' });
        if (!result) {
            return new NextResponse('Not found', { status: 404 });
        }
        targetUrl = result.blob.url;
    }

    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    console.log(`[MediaProxy] Fetching configured media host: ${targetHost} (Range: ${range?.value || 'none'})`);

    const response = await fetch(targetUrl, {
        headers: range?.value ? { Range: range.value } : {}
    });

    if (!response.ok && response.status !== 206) {
        console.error(`[MediaProxy] Upstream media error: ${response.status} ${response.statusText} from ${targetHost}`);
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
    console.error('Error accessing gated media:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
