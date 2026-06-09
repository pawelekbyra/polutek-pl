import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { prisma } from '@/lib/prisma';
// R6/R3 delivery blocker: playback still uses legacy access policy.
// Do not expose raw videoUrl to public UI; gated playback migration remains future work.
import { AccessPolicy } from '@/lib/access/access-policy';
import { flags } from '@/lib/feature-flags';
import { INITIAL_VIDEOS } from '@/lib/data/initial-content';
import { PlaybackService } from '@/lib/services/playback/playback.service';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { recordAlert } from '@/lib/observability';
import { handleApiError } from '@/lib/errors';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { videoId: string } }) {
  const requestId = getCorrelationId();
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

    const ip = getMediaClientIp(req) || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const uaHash = crypto.createHash('sha256').update(ua).digest('hex');

    const playbackPlan = await PlaybackService.createPlaybackPlan(videoId, userId, ipHash, uaHash);

    // Maintain legacy compatibility for now
    const response = {
        ...playbackPlan,
        hasAccess: playbackPlan.access.allowed,
        kind: playbackPlan.source?.kind,
        playbackUrl: playbackPlan.source?.playbackUrl,
        embedUrl: playbackPlan.source?.embedUrl,
    };

    if (!playbackPlan.access.allowed) {
        return NextResponse.json(response, { status: 403 });
    }

    return NextResponse.json(response);
  } catch (error) {
    scopedLogger.error('[MEDIA_SOURCE_GET_ERROR]', error);
    return handleApiError(error);
  }
}
