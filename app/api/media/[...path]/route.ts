import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { userId } = await auth();

  // Extract videoId from the path params instead of searchParams for cleaner /api/media/[videoId] pattern
  // path[0] will be the videoId if called as /api/media/VIDEO_ID
  const videoId = params.path[0];

  if (!videoId) {
    return NextResponse.json({ error: 'Bad Request: videoId is required' }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { videoUrl: true }
  });

  if (!video) {
    // Try by slug if ID not found (optional fallback)
    const videoBySlug = await prisma.video.findUnique({
        where: { slug: videoId },
        select: { id: true, videoUrl: true }
    });

    if (!videoBySlug) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return getGatedBlobResponse(userId, videoBySlug.id, videoBySlug.videoUrl);
  }

  // Securely stream the gated content from Vercel Blob
  return getGatedBlobResponse(userId, videoId, video.videoUrl, req.headers);
}
