import { NextRequest, NextResponse } from 'next/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { recordAlert } from '@/lib/observability';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getGatedMedia } from '@/lib/modules/media';
import { VideoPolicy } from '@/lib/modules/video';

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

  const videoIdOrSlug = params.path[0];

  if (!videoIdOrSlug) {
    return NextResponse.json({ error: 'Bad Request: videoId is required' }, { status: 400 });
  }

  try {
    const mediaRateLimit = await rateLimit({
      key: buildMediaRateLimitKey({ userId, ip: getMediaClientIp(req), mediaId: videoIdOrSlug }),
      limit: 240,
      windowMs: 60_000,
    });

    if (!mediaRateLimit.success) {
      return rateLimitedResponse(videoIdOrSlug);
    }

    const ctx = createAppContext({ actor, requestId: requestId || undefined });
    const result = await getGatedMedia({ videoIdOrSlug }, ctx);

    if (!result.ok) {
        if (result.error.name === 'MediaSourceNotFoundError') {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 });
        }
        throw result.error;
    }

    const { id, videoUrl } = result.data;

    const videoPlaybackPolicy = await ctx.prisma.video.findUnique({
      where: { id },
      select: {
        tier: true,
        asset: {
          select: {
            provider: true,
            processingState: true,
            isPrimary: true,
          },
        },
      },
    });

    if (VideoPolicy.shouldBlockLegacyPrivatePlaybackFallback(videoPlaybackPolicy)) {
      recordAlert('media_proxy.legacy_private_fallback_blocked', { videoId: id });
      return NextResponse.json(
        {
          success: false,
          error: 'NO_PRIMARY_ASSET',
          message: 'Private playback requires a ready provider-backed video asset.',
        },
        { status: 403 },
      );
    }

    return getGatedBlobResponse(userId, id, videoUrl, req.headers);
  } catch (error) {
    scopedLogger.error("[MEDIA_PROXY_ERROR]", error);
    return handleApiError(error);
  }
}
