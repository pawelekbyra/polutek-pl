import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { setNxEx } from "@/lib/rate-limit";
import { RecordPlaybackEventInput, PLAYBACK_EVENT_TYPES } from "../domain/video.dto";
import {
    InvalidPlaybackSessionError,
    PlaybackSessionOwnershipMismatchError,
    PlaybackSessionAnonymousForbiddenError,
    PlaybackSessionRequiresAuthError,
    PlaybackSessionFingerprintMismatchError,
    PlaybackSessionExpiredError,
    PlaybackSessionRequiredError,
    InvalidPlaybackEventTypeError
} from "../domain/video.errors";
import { VideoPlaybackRepository } from "../infrastructure/video-playback.repository";

export interface RecordPlaybackEventResult {
    success: true;
    throttled?: boolean;
}

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

export async function recordPlaybackEventUseCase(
    input: RecordPlaybackEventInput,
    ctx: AppContext
): Promise<UseCaseResult<RecordPlaybackEventResult>> {
    const { videoId, sessionId, type, positionMs, durationMs, metadata, ipHash, uaHash, fingerprint } = input;
    const { actor, db, prisma: rawPrisma } = ctx;
    const userId = actor.type === 'user' ? actor.userId : (actor.type === 'admin' ? actor.userId : null);

    if (!PLAYBACK_EVENT_TYPES.includes(type)) {
        return { ok: false, error: new InvalidPlaybackEventTypeError() };
    }

    // Backend access check
    const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);
    if (!accessResult.ok) {
        return { ok: false, error: accessResult.error };
    }

    const access = accessResult.data;
    if (!access.hasAccess && type !== 'ACCESS_ERROR') {
        return { ok: false, error: { ...new Error("ACCESS_DENIED"), code: 'ACCESS_DENIED', status: 403, reason: access.reason } as any };
    }

    // For writes, we use rawPrisma or db.writeTransaction.
    // db.read is for read replicas and should not be used for writes.
    const repo = new VideoPlaybackRepository(rawPrisma);
    let session = null;

    if (sessionId) {
        session = await repo.findSessionById(sessionId);
        if (!session || session.videoId !== videoId) {
            return { ok: false, error: new InvalidPlaybackSessionError() };
        }

        // Ownership check
        if (userId) {
            if (session.userId && session.userId !== userId) {
                return { ok: false, error: new PlaybackSessionOwnershipMismatchError() };
            }
            if (!session.userId) {
                return { ok: false, error: new PlaybackSessionAnonymousForbiddenError() };
            }
        } else {
            // Anonymous check via fingerprint (ipHash + userAgentHash)
            if (session.userId) {
                 return { ok: false, error: new PlaybackSessionRequiresAuthError() };
            }
            if (session.ipHash !== ipHash || session.userAgentHash !== uaHash) {
                return { ok: false, error: new PlaybackSessionFingerprintMismatchError() };
            }
        }

        // Session expiration check (24h)
        const sessionAgeMs = Date.now() - session.createdAt.getTime();
        if (sessionAgeMs > 24 * 60 * 60 * 1000) {
            return { ok: false, error: new PlaybackSessionExpiredError() };
        }
    } else if (['WATCHED_10_SECONDS', 'PROGRESS', 'HEARTBEAT'].includes(type)) {
        return { ok: false, error: new PlaybackSessionRequiredError() };
    }

    // Throttling logic
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

            await repo.updateSession(sessionId, {
                lastHeartbeatAt: now,
                firstPlayAt: type === 'PLAY_STARTED' && !session?.firstPlayAt ? now : undefined,
                totalWatchMs: { increment: Math.floor(incrementMs) },
                maxProgressMs: positionMs ? Math.max(session?.maxProgressMs || 0, positionMs) : undefined,
                durationMs: durationMs || undefined,
            }).catch(err => console.warn("[SESSION_UPDATE_ERROR]", err));
        }
    }

    // Record the event
    if (shouldSaveEvent) {
        await repo.createEvent({
            session: sessionId ? { connect: { id: sessionId } } : undefined,
            video: { connect: { id: videoId } },
            userId,
            type,
            positionMs,
            durationMs,
            bufferedMs: input.bufferedMs,
            volume: input.volume,
            muted: input.muted,
            fullscreen: input.fullscreen,
            errorCode: input.errorCode,
            errorMessage: input.errorMessage,
            provider: input.provider,
            sourceKind: input.sourceKind,
            metadata: sanitizePlaybackMetadata(metadata)
        });
    }

    // View counting
    if (type === 'WATCHED_10_SECONDS' && session && !session.isAdminPreview && !session.countedAsView) {
        const identifier = userId ? `u:${userId}` : `f:${fingerprint}`;
        const lockKey = `video:view:${videoId}:${identifier}`;
        const isNewView = await setNxEx(lockKey, '1', 86400);

        if (isNewView) {
            await db.writeTransaction(async (tx) => {
                const txRepo = new VideoPlaybackRepository(tx);
                await txRepo.recordView(videoId, sessionId!, userId, ipHash);
            });
        } else {
            await repo.markSessionAsViewed(sessionId!);
        }
    }

    return {
        ok: true,
        data: {
            success: true,
            throttled: isProgressOrHeartbeat && !shouldSaveEvent ? true : undefined
        }
    };
}
