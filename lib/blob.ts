import { get } from "@vercel/blob";
import { AccessPolicy } from "./access/access-policy";
import { NextResponse } from 'next/server';

/**
 * Serves a private Vercel Blob file as a stream.
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
    const response = await fetch(targetUrl, {
        headers: range ? { Range: range } : {}
    });

    if (!response.ok && response.status !== 206) {
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
