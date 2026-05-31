import { get } from "@vercel/blob";
import { AccessPolicy } from "./access/access-policy";
import { NextResponse } from 'next/server';

const DEFAULT_ALLOWED_MEDIA_HOSTS = [
    'public.blob.vercel-storage.com',
    'vercel-storage.com',
    'r2.cloudflarestorage.com',
    'r2.dev',
    'pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev',
];

const ALLOWED_MEDIA_HOSTS = [
    ...DEFAULT_ALLOWED_MEDIA_HOSTS,
    ...[process.env.MEDIA_BUCKET_HOST, process.env.NEXT_PUBLIC_R2_PUBLIC_HOST]
        .filter((host): host is string => !!host)
        .map(host => host.trim().toLowerCase())
        .filter(Boolean),
    ...(process.env.MEDIA_PROXY_ALLOWED_HOSTS || '')
        .split(',')
        .map(host => host.trim().toLowerCase())
        .filter(Boolean),
];

function isHostAllowed(url: string) {
    try {
        const { hostname } = new URL(url);
        return ALLOWED_MEDIA_HOSTS.includes(hostname.toLowerCase());
    } catch {
        return false;
    }
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

/**
 * Serves a private Vercel Blob or external file as a gated stream.
 */
export async function getGatedBlobResponse(
  userId: string | null,
  videoId: string,
  blobUrl: string,
  headers?: Headers
) {
  const decision = await AccessPolicy.canViewVideo(userId, videoId);

  if (!decision.allowed) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!isHostAllowed(blobUrl)) {
    console.error(`[MediaProxy] Blocked unauthorized host: ${blobUrl}`);
    return new NextResponse('Unauthorized Media Host', { status: 403 });
  }

  const range = getValidatedRange(headers);
  if (range?.error) {
    return new NextResponse('Invalid Range header', { status: 416 });
  }

  try {
    const isVercelBlob = blobUrl.includes('public.blob.vercel-storage.com') || blobUrl.includes('vercel-storage.com');
    let targetUrl = blobUrl;

    if (isVercelBlob) {
        const result = await get(blobUrl, { access: 'private' });
        if (!result) {
            return new NextResponse('Not found', { status: 404 });
        }
        targetUrl = result.blob.url;
    }

    console.log(`[MediaProxy] Fetching: ${targetUrl} (Range: ${range?.value || 'none'})`);

    const response = await fetch(targetUrl, {
        headers: range?.value ? { Range: range.value } : {}
    });

    if (!response.ok && response.status !== 206) {
        console.error(`[MediaProxy] Upstream error: ${response.status} ${response.statusText} for ${targetUrl}`);
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
    console.error('Error accessing gated Blob:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
