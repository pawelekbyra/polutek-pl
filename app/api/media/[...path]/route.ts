import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { prisma } from '@/lib/prisma';
import { flags } from '@/lib/feature-flags';
import { INITIAL_VIDEOS } from '@/lib/data/initial-content';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { RateLimitConfigurationError } from '@/lib/rate-limit';

function rateLimitedResponse() {
  return NextResponse.json(
    {
      success: false,
      error: 'RATE_LIMITED',
      message: 'Za dużo żądań. Spróbuj ponownie za chwilę.',
    },
    { status: 429 },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
  const { userId } = await auth();

  // Extract videoId from the path params instead of searchParams for cleaner /api/media/[videoId] pattern
  // path[0] will be the videoId if called as /api/media/VIDEO_ID
  const videoId = params.path[0];

  if (!videoId) {
    return NextResponse.json({ error: 'Bad Request: videoId is required' }, { status: 400 });
  }

  const mediaRateLimit = await rateLimit({
    key: buildMediaRateLimitKey({ userId, ip: getMediaClientIp(req), mediaId: videoId }),
    limit: 240,
    windowMs: 60_000,
  });

  if (!mediaRateLimit.success) {
    return rateLimitedResponse();
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

  // Securely stream the gated content from configured media storage
  return getGatedBlobResponse(userId, videoId, video.videoUrl, req.headers);
  } catch (error: unknown) {
    if (error instanceof RateLimitConfigurationError) {
        console.error("[RATE_LIMIT_CONFIG_ERROR]", {
            route: "/api/media/[...path]",
            missing: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
        });
        return NextResponse.json(
            {
                error: "SERVICE_CONFIGURATION_ERROR",
                message: "Odtwarzanie materiału jest chwilowo niedostępne."
            },
            { status: 503 }
        );
    }
    throw error;
  }
}
