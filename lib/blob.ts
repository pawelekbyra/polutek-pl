import { get } from "@vercel/blob";
import { AccessPolicy } from "./access/access-policy";
import { NextResponse } from 'next/server';

const ALLOWED_MEDIA_HOSTS = [
    'public.blob.vercel-storage.com',
    'vercel-storage.com',
    'r2.cloudflarestorage.com',
    'r2.dev',
    'pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev', // Specific R2 bucket from initial-content
    'unsplash.com',
    'images.unsplash.com'
];

function isHostAllowed(url: string) {
    try {
        const { hostname } = new URL(url);
        return ALLOWED_MEDIA_HOSTS.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`));
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

    const range = headers?.get('range');
    console.log(`[MediaProxy] Fetching: ${targetUrl} (Range: ${range || 'none'})`);

    const response = await fetch(targetUrl, {
        headers: range ? { Range: range } : {}
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
