import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { setNxEx, rateLimit } from '@/lib/rate-limit';
import { getMediaClientIp } from '@/lib/media/rate-limit';
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  const videoId = params.id;
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);

  try {
    const ip = getMediaClientIp(req);
    const rl = await rateLimit({
        key: `playback-event:${userId || ip}`,
        limit: 120, // 2 events per minute average
        windowMs: 60 * 1000
    });

    if (!rl.success) {
        return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const body = await req.json();
    const { sessionId, type, positionMs, durationMs, errorCode, errorMessage } = body;

    if (!PLAYBACK_EVENT_TYPES.includes(type)) {
        return NextResponse.json({ error: 'INVALID_EVENT_TYPE' }, { status: 400 });
    }

    const videoExists = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true } });
    if (!videoExists) {
        return NextResponse.json({ error: 'VIDEO_NOT_FOUND' }, { status: 404 });
    }

    let session = null;
    if (sessionId) {
        session = await prisma.videoPlaybackSession.findUnique({ where: { id: sessionId } });
        if (!session || session.videoId !== videoId) {
            return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 403 });
        }
        // Basic ownership check via IP hash if not logged in
        if (!userId && session.ipHash) {
            const currentIpHash = crypto.createHash('sha256').update(ip).digest('hex');
            if (session.ipHash !== currentIpHash) {
                return NextResponse.json({ error: 'SESSION_OWNERSHIP_MISMATCH' }, { status: 403 });
            }
        } else if (userId && session.userId && session.userId !== userId) {
             return NextResponse.json({ error: 'SESSION_USER_MISMATCH' }, { status: 403 });
        }
    }

    // 1. Record the event
    await prisma.videoPlaybackEvent.create({
      data: {
        sessionId,
        videoId,
        userId,
        type,
        positionMs,
        durationMs,
        errorCode,
        errorMessage
      }
    });

    // 2. Handle specific events (like real view counting)
    if (type === 'WATCHED_10_SECONDS' && (!session || !session.isAdminPreview)) {
        const identifier = userId ? `u:${userId}` : `h:${crypto.createHash('sha256').update(ip).digest('hex')}`;
        const lockKey = `video:view:${videoId}:${identifier}`;
        const isNewView = await setNxEx(lockKey, '1', 86400); // 24h deduplication

        if (isNewView) {
            await prisma.$transaction([
                prisma.videoView.create({
                    data: {
                        videoId,
                        userId: userId || null,
                        ipHash: userId ? null : crypto.createHash('sha256').update(ip).digest('hex')
                    }
                }),
                prisma.video.update({
                    where: { id: videoId },
                    data: { views: { increment: 1 } }
                }),
                ...(sessionId ? [
                    prisma.videoPlaybackSession.update({
                        where: { id: sessionId },
                        data: { countedAsView: true }
                    })
                ] : [])
            ]);
        }
    }

    // 3. Update session heartbeats
    if (sessionId && ['HEARTBEAT', 'PROGRESS', 'PLAY_STARTED', 'WATCHED_10_SECONDS'].includes(type)) {
        const now = new Date();
        const timeSinceLastHeartbeat = now.getTime() - (session?.lastHeartbeatAt.getTime() || now.getTime());
        // Simple heuristic: if heartbeat within expected window (15s +/- 5s), add 15s to totalWatchMs
        const incrementMs = (type === 'HEARTBEAT' && timeSinceLastHeartbeat < 25000) ? 15000 : 0;

        await prisma.videoPlaybackSession.update({
            where: { id: sessionId },
            data: {
                lastHeartbeatAt: now,
                totalWatchMs: { increment: incrementMs },
                maxProgressMs: positionMs ? { set: Math.max(session?.maxProgressMs || 0, positionMs) } : undefined,
                durationMs: durationMs ? { set: durationMs } : undefined
            }
        }).catch(err => scopedLogger.warn("[SESSION_UPDATE_ERROR]", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    scopedLogger.error('[PLAYBACK_EVENT_POST_ERROR]', error);
    return handleApiError(error);
  }
}
