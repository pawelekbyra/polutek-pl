import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';
import { flags } from '@/lib/feature-flags';
import { INITIAL_VIDEOS } from '@/lib/data/initial-content';
import { getVideoSourceInfo } from '@/lib/media/video-source';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { isAllowedVideoSourceUrl } from '@/lib/blob';
import { recordAlert, recordMetric } from '@/lib/observability';
import { handleApiError } from '@/lib/errors';
import { setNxEx } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { videoId: string } }) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { userId } = await auth();
  const videoId = params.videoId;

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const rateLimitResult = await rateLimit({
      key: `media-source:${buildMediaRateLimitKey({ userId, ip: getMediaClientIp(req), mediaId: videoId })}`,
      limit: 60,
      windowMs: 60 * 1000
    });

    if (!rateLimitResult.success) {
      recordAlert('media_source.rate_limited', { videoId });
      return NextResponse.json({
          error: 'RATE_LIMITED',
          message: 'Zbyt wiele zapytań o źródło wideo. Spróbuj za chwilę.'
      }, { status: 429 });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { creator: true }
    });

    const decision = await AccessPolicy.canViewVideo(userId, videoId, video);
    if (!decision.allowed) {
      recordMetric('media_source.access_denied', { videoId, reason: decision.reason || 'unknown', requiredTier: decision.requiredTier || 'unknown' }, { level: 'warn' });
      return NextResponse.json({ hasAccess: false, reason: decision.reason, requiredTier: decision.requiredTier }, { status: 403 });
    }

    const fallback = !video && flags.demoFallbacks ? INITIAL_VIDEOS.find((item) => item.id === videoId || item.slug === videoId) : null;
    const resolvedVideo = video || fallback;

    if (!resolvedVideo?.videoUrl) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!isAllowedVideoSourceUrl(resolvedVideo.videoUrl)) {
      recordAlert('media_source.host_blocked', { videoId });
      return NextResponse.json({ error: 'VIDEO_SOURCE_NOT_ALLOWED' }, { status: 400 });
    }

    const source = getVideoSourceInfo(resolvedVideo.videoUrl, `/api/media/${resolvedVideo.id}`);

    // Non-blocking view count tracking with deduplication
    if (video) {
        (async () => {
            try {
                const identifier = userId || getMediaClientIp(req) || 'anonymous';
                const lockKey = `video:view:${videoId}:${identifier}`;
                const isNewView = await setNxEx(lockKey, '1', 3600);

                if (isNewView) {
                    await prisma.$transaction([
                        prisma.videoView.create({
                            data: {
                                videoId,
                                userId: userId || null,
                                ipHash: !userId ? identifier : null
                            }
                        }),
                        prisma.video.update({
                            where: { id: videoId },
                            data: { views: { increment: 1 } }
                        })
                    ]);
                }
            } catch (trackError) {
                scopedLogger.warn('[VIDEO_VIEW_TRACK_ERROR]', trackError);
            }
        })();
    }

    return NextResponse.json({
      hasAccess: true,
      ...source,
    });
  } catch (error) {
    scopedLogger.error('[MEDIA_SOURCE_GET_ERROR]', error);
    return handleApiError(error);
  }
}
