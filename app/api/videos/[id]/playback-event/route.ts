import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { setNxEx } from '@/lib/rate-limit';
import { getMediaClientIp } from '@/lib/media/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  const videoId = params.id;
  const scopedLogger = createScopedLogger();

  try {
    const body = await req.json();
    const { sessionId, type, positionMs, durationMs, errorCode, errorMessage } = body;

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
    if (type === 'WATCHED_10_SECONDS') {
        const identifier = userId || getMediaClientIp(req) || 'anonymous';
        const lockKey = `video:view:${videoId}:${identifier}`;
        const isNewView = await setNxEx(lockKey, '1', 3600);

        if (isNewView) {
            await prisma.$transaction([
                prisma.videoView.create({
                    data: {
                        videoId,
                        userId: userId || null,
                        ipHash: identifier
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
    if (sessionId && ['HEARTBEAT', 'PROGRESS', 'PLAY_STARTED'].includes(type)) {
        await prisma.videoPlaybackSession.update({
            where: { id: sessionId },
            data: {
                lastHeartbeatAt: new Date(),
                totalWatchMs: { increment: type === 'HEARTBEAT' ? 15000 : 0 }, // Simplified
                maxProgressMs: positionMs ? { set: positionMs } : undefined,
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
