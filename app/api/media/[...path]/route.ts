import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { prisma } from '@/lib/prisma';
import { flags } from '@/lib/feature-flags';
import { INITIAL_VIDEOS } from '@/lib/data/initial-content';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { recordAlert } from '@/lib/observability';

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

async function handleMediaRequest(
    req: NextRequest,
    videoId: string,
    method: string
) {
    const requestId = getCorrelationId();
    const scopedLogger = createScopedLogger(requestId);
    const { userId } = await auth();

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
        include: {
          creator: {
            select: { id: true, slug: true, isApproved: true, isPrimary: true }
          }
        }
      });

      if (!video) {
        const videoBySlug = await prisma.video.findUnique({
            where: { slug: videoId },
            include: {
              creator: {
                select: { id: true, slug: true, isApproved: true, isPrimary: true }
              }
            }
        });

        if (!videoBySlug) {
            if (flags.demoFallbacks) {
                const fallback = INITIAL_VIDEOS.find(v => v.id === videoId || v.slug === videoId);
                if (fallback) {
                    return getGatedBlobResponse(userId, fallback.id, fallback.videoUrl, req.headers, {
                        id: fallback.id,
                        creatorId: fallback.creatorId || 'demo-creator',
                        tier: fallback.tier,
                        status: fallback.status,
                        publishedAt: fallback.publishedAt ? new Date(fallback.publishedAt) : null,
                    }, method);
                }
            }
            return NextResponse.json({ error: 'Video not found' }, { status: 404 });
        }

        return getGatedBlobResponse(userId, videoBySlug.id, videoBySlug.videoUrl, req.headers, videoBySlug, method);
      }

      return getGatedBlobResponse(userId, videoId, video.videoUrl, req.headers, video, method);
    } catch (error) {
      scopedLogger.error("[MEDIA_PROXY_ERROR]", error);
      return handleApiError(error);
    }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleMediaRequest(req, params.path[0], 'GET');
}

export async function HEAD(
    req: NextRequest,
    { params }: { params: { path: string[] } }
) {
    return handleMediaRequest(req, params.path[0], 'HEAD');
}
