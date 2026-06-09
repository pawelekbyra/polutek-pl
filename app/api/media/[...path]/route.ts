import { NextRequest, NextResponse } from 'next/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { prisma } from '@/lib/prisma';
import { canUseDemoFallbacks } from '@/lib/feature-flags';
import { INITIAL_VIDEOS } from '@/lib/data/initial-content';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { recordAlert } from '@/lib/observability';
import { getActorFromAuth } from '@/lib/api/auth';

function rateLimitedResponse(videoId: string) {
  recordAlert('media_proxy.rate_limited', { videoId });
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
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();
  const userId = actor.type === 'user' ? actor.userId : (actor.type === 'admin' ? actor.userId : null);

  const videoId = params.path[0];

  if (!videoId) {
    return NextResponse.json({ error: 'Bad Request: videoId is required' }, { status: 400 });
  }

  try {
    const mediaRateLimit = await rateLimit({
      key: buildMediaRateLimitKey({ userId, ip: getMediaClientIp(req), mediaId: videoId }),
      limit: 240,
      windowMs: 60_000,
    });

    if (!mediaRateLimit.success) {
      return rateLimitedResponse(videoId);
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      const videoBySlug = await prisma.video.findUnique({
          where: { slug: videoId },
      });

      if (!videoBySlug) {
          if (canUseDemoFallbacks()) {
              const fallback = INITIAL_VIDEOS.find(v => v.id === videoId || v.slug === videoId);
              if (fallback) {
                  return getGatedBlobResponse(userId, fallback.id, fallback.videoUrl, req.headers);
              }
          }
          return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }

      return getGatedBlobResponse(userId, videoBySlug.id, videoBySlug.videoUrl, req.headers);
    }

    return getGatedBlobResponse(userId, videoId, video.videoUrl, req.headers);
  } catch (error) {
    scopedLogger.error("[MEDIA_PROXY_ERROR]", error);
    return handleApiError(error);
  }
}
