import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { setNxEx, rateLimit } from '@/lib/rate-limit';
import { getMediaClientIp } from '@/lib/media/rate-limit';
import { AccessPolicy } from '@/lib/access/access-policy';
import { countGraphemes } from '@/lib/utils/graphemes';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const PLAYBACK_EVENT_TYPES = [
  "PLAYER_READY",
  "PLAY_REQUESTED",
  "PLAY_STARTED",
  "PLAY_PAUSED",
  "PLAY_RESUMED",
  "BUFFERING_STARTED",
  "BUFFERING_ENDED",
  "SEEKED",
  "PROGRESS",
  "HEARTBEAT",
  "WATCHED_10_SECONDS",
  "WATCHED_25_PERCENT",
  "WATCHED_50_PERCENT",
  "WATCHED_75_PERCENT",
  "WATCHED_90_PERCENT",
  "ENDED",
  "PLAYER_ERROR",
  "SOURCE_ERROR",
  "ACCESS_ERROR"
] as const;

function sanitizePlaybackMetadata(metadata: any) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;

  const forbiddenFragments = ['url', 'playbackurl', 'signedurl', 'token', 'secret', 'authorization', 'cookie', 'signature'];

  const keys = Object.keys(metadata);
  const finalFilteredKeys = keys.filter(key => {
      const lowerKey = key.toLowerCase();
      return !forbiddenFragments.some(fragment => lowerKey.includes(fragment));
  });

  // Limit to 20 keys and values up to 500 chars
  const result: Record<string, any> = {};
  const finalKeys = finalFilteredKeys.slice(0, 20);

  for (const key of finalKeys) {
    let value = metadata[key];
    if (typeof value === 'string' && value.length > 500) {
      value = value.substring(0, 500);
    }
    result[key] = value;
  }

  return result;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  const videoId = params.id;
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);

  try {
    const ip = getMediaClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Secure fingerprinting
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const uaHash = crypto.createHash('sha256').update(userAgent).digest('hex');
    const fingerprint = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex');

    const rl = await rateLimit({
        key: `playback-event:${userId || ipHash}`,
        limit: 150, // Slightly higher limit to accommodate heartbeats
        windowMs: 60 * 1000
    });

    if (!rl.success) {
        return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const body = await req.json();
    const {
        sessionId,
        type,
        positionMs,
        durationMs,
        errorCode,
        errorMessage,
        provider,
        sourceKind,
        metadata,
        bufferedMs,
        volume,
        muted,
        fullscreen
    } = body;

    if (!PLAYBACK_EVENT_TYPES.includes(type)) {
        return NextResponse.json({ error: 'INVALID_EVENT_TYPE' }, { status: 400 });
    }

    // Check video existence and fetch basic info for access check
    const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { id: true, status: true, tier: true, publishedAt: true }
    });

    if (!video) {
        return NextResponse.json({ error: 'VIDEO_NOT_FOUND' }, { status: 404 });
    }

    // Backend access check - don't trust the frontend
    const access = await AccessPolicy.canViewVideo(userId, videoId, video);
    if (!access.allowed && type !== 'ACCESS_ERROR') {
        return NextResponse.json({ error: 'ACCESS_DENIED', reason: access.reason }, { status: 403 });
    }

    let session = null;
    if (sessionId) {
        session = await prisma.videoPlaybackSession.findUnique({ where: { id: sessionId } });
        if (!session || session.videoId !== videoId) {
            return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 403 });
        }

        // Ownership check
        if (userId) {
            if (session.userId && session.userId !== userId) {
                return NextResponse.json({ error: 'SESSION_USER_MISMATCH' }, { status: 403 });
            }
            if (!session.userId) {
                return NextResponse.json({ error: 'SESSION_ANONYMOUS_FORBIDDEN' }, { status: 403 });
            }
        } else {
            // Anonymous check via fingerprint (ipHash + userAgentHash)
            if (session.userId) {
                 return NextResponse.json({ error: 'SESSION_REQUIRES_AUTH' }, { status: 403 });
            }
            if (session.ipHash !== ipHash || session.userAgentHash !== uaHash) {
                return NextResponse.json({ error: 'SESSION_OWNERSHIP_MISMATCH' }, { status: 403 });
            }
        }

        // Session expiration check (e.g. 24h)
        const sessionAgeMs = Date.now() - session.createdAt.getTime();
        if (sessionAgeMs > 24 * 60 * 60 * 1000) {
            return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 403 });
        }
    } else if (['WATCHED_10_SECONDS', 'PROGRESS', 'HEARTBEAT'].includes(type)) {
        // Require session for critical events
        return NextResponse.json({ error: 'SESSION_REQUIRED' }, { status: 400 });
    }

    // Throttling logic for PROGRESS/HEARTBEAT
    const isProgressOrHeartbeat = ['PROGRESS', 'HEARTBEAT'].includes(type);
    let shouldSaveEvent = true;

    if (sessionId && (isProgressOrHeartbeat || ['PLAY_STARTED', 'WATCHED_10_SECONDS'].includes(type))) {
        const now = new Date();
        const lastHeartbeat = session?.lastHeartbeatAt || session?.createdAt || now;
        const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();

        const isCritical = ['PLAY_STARTED', 'WATCHED_10_SECONDS'].includes(type);
        const shouldUpdateStats = isCritical || timeSinceLastHeartbeat >= 10000;

        if (isProgressOrHeartbeat && !shouldUpdateStats) {
            shouldSaveEvent = false;
        }

        if (shouldUpdateStats) {
            const incrementMs = !isCritical && timeSinceLastHeartbeat < 30000 ? timeSinceLastHeartbeat : 0;

            await prisma.videoPlaybackSession.update({
                where: { id: sessionId },
                data: {
                    lastHeartbeatAt: now,
                    firstPlayAt: type === 'PLAY_STARTED' && !session?.firstPlayAt ? now : undefined,
                    totalWatchMs: { increment: Math.floor(incrementMs) },
                    maxProgressMs: positionMs ? Math.max(session?.maxProgressMs || 0, positionMs) : undefined,
                    durationMs: durationMs || undefined,
                }
            }).catch(err => scopedLogger.warn("[SESSION_UPDATE_ERROR]", err));
        }
    }

    // 1. Record the event (if not throttled)
    if (shouldSaveEvent) {
        await prisma.videoPlaybackEvent.create({
          data: {
            sessionId,
            videoId,
            userId,
            type,
            positionMs,
            durationMs,
            bufferedMs,
            volume,
            muted,
            fullscreen,
            errorCode,
            errorMessage,
            provider,
            sourceKind,
            metadata: sanitizePlaybackMetadata(metadata)
          }
        });
    }

    // 2. Handle view counting
    if (type === 'WATCHED_10_SECONDS' && session && !session.isAdminPreview && !session.countedAsView) {
        const identifier = userId ? `u:${userId}` : `f:${fingerprint}`;
        const lockKey = `video:view:${videoId}:${identifier}`;
        const isNewView = await setNxEx(lockKey, '1', 86400); // 24h deduplication

        if (isNewView) {
            await prisma.$transaction([
                prisma.videoView.create({
                    data: {
                        videoId,
                        userId: userId || null,
                        ipHash: userId ? null : ipHash
                    }
                }),
                prisma.video.update({
                    where: { id: videoId },
                    data: { views: { increment: 1 } }
                }),
                prisma.videoPlaybackSession.update({
                    where: { id: sessionId },
                    data: { countedAsView: true }
                })
            ]);
        } else {
            await prisma.videoPlaybackSession.update({
                where: { id: sessionId },
                data: { countedAsView: true }
            });
        }
    }

    return NextResponse.json({
        success: true,
        throttled: isProgressOrHeartbeat && !shouldSaveEvent ? true : undefined
    });
  } catch (error) {
    scopedLogger.error('[PLAYBACK_EVENT_POST_ERROR]', error);
    return handleApiError(error);
  }
}
