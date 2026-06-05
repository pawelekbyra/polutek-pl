import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';
import { flags } from '@/lib/feature-flags';
import { INITIAL_VIDEOS } from '@/lib/data/initial-content';
import { getVideoSourceInfo } from '@/lib/media/video-source';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { videoId: string } }) {
  const { userId } = await auth();
  const videoId = params.videoId;

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  // Rate Limiting
  const rateLimitResult = await rateLimit({
    key: `media-source:${buildMediaRateLimitKey({ userId, ip: getMediaClientIp(req), mediaId: videoId })}`,
    limit: 60,
    windowMs: 60 * 1000
  });

  if (!rateLimitResult.success) {
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
    return NextResponse.json({ hasAccess: false, reason: decision.reason, requiredTier: decision.requiredTier }, { status: 403 });
  }

  const fallback = !video && flags.demoFallbacks ? INITIAL_VIDEOS.find((item) => item.id === videoId || item.slug === videoId) : null;
  const resolvedVideo = video || fallback;

  if (!resolvedVideo?.videoUrl) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const source = getVideoSourceInfo(resolvedVideo.videoUrl, `/api/media/${resolvedVideo.id}`);

  if ((source.kind === 'hls' || source.kind === 'dash') && source.needsProxy) {
    logger.warn(`[MediaSource] Blocked UNSAFE_STREAM_SOURCE for video ${videoId} (kind: ${source.kind}). Signed delivery/proxy required.`);
    return NextResponse.json({
      error: 'UNSAFE_STREAM_SOURCE',
      message: 'Streaming HLS/DASH wymaga signed delivery/proxy przed produkcją.'
    }, { status: 503 });
  }

  return NextResponse.json({
    hasAccess: true,
    ...source,
  });
}
