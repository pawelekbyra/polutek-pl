import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { prisma } from '@/lib/prisma';
import { flags } from '@/lib/feature-flags';
import { INITIAL_VIDEOS } from '@/lib/data/initial-content';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { userId } = await auth();
    const { videoId } = params;

    // Rate limiting for media streaming to prevent abuse
    const identifier = userId || req.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResult = await rateLimit({
      key: `media:${videoId}:${identifier}`,
      limit: 100, // Reasonable limit for chunks/requests
      windowMs: 60 * 1000
    });

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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
          // Final fallback to initial videos if demo content is enabled
          if (flags.demoFallbacks) {
              const fallback = INITIAL_VIDEOS.find(v => v.id === videoId || v.slug === videoId);
              if (fallback) {
                  return getGatedBlobResponse(userId, fallback.id, fallback.videoUrl, req.headers);
              }
          }
          return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }

      return getGatedBlobResponse(userId, videoBySlug.id, videoBySlug.videoUrl, req.headers);
    }

    // Securely stream the gated content
    return getGatedBlobResponse(userId, videoId, video.videoUrl, req.headers);
  } catch (error) {
    return handleApiError(error);
  }
}
