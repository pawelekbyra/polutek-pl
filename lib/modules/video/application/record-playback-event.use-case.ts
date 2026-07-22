import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult } from "@/lib/modules/shared/result";
import { checkVideoAccess } from "@/lib/modules/access";
import { setNxEx } from "@/lib/rate-limit";
import { recordGlobalMuxPlaybackEvent } from "../infrastructure/mux-circuit-breaker";
import { RecordPlaybackEventInput, PLAYBACK_EVENT_TYPES } from "../domain/video.dto";
import {
    InvalidPlaybackSessionError,
    PlaybackSessionOwnershipMismatchError,
    PlaybackSessionAnonymousForbiddenError,
    PlaybackSessionRequiresAuthError,
    PlaybackSessionFingerprintMismatchError,
    PlaybackSessionExpiredError,
    PlaybackSessionRequiredError,
    InvalidPlaybackEventTypeError,
    PlaybackAccessDeniedError
} from "../domain/video.errors";
import { VideoPlaybackRepository } from "../infrastructure/video-playback.repository";

export interface RecordPlaybackEventResult {
    success: true;
    throttled?: boolean;
    viewCounted?: boolean;
}

type SanitizedPlaybackMetadataValue =
  | string
  | number
  | boolean
  | null
  | SanitizedPlaybackMetadataValue[]
  | { [key: string]: SanitizedPlaybackMetadataValue };

const forbiddenMetadataFragments = ['url', 'playbackurl', 'signedurl', 'token', 'secret', 'authorization', 'cookie', 'signature'];

function isForbiddenMetadataKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return forbiddenMetadataFragments.some(fragment => lowerKey.includes(fragment));
}

function isMetadataRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}


function getWatchedViewThresholdMs(durationMs: number | null | undefined): number {
  if (Number.isFinite(durationMs) && durationMs && durationMs > 0) {
    return Math.min(10000, Math.floor(durationMs * 0.9));
  }

  return 10000;
}

function hasCredibleWatchedViewEvidence(params: {
  positionMs?: number | null;
  durationMs?: number | null;
  firstPlayAt?: Date | null;
  maxProgressMs?: number | null;
}): boolean {
  const thresholdMs = getWatchedViewThresholdMs(params.durationMs);
  const positionMs = Number.isFinite(params.positionMs) && params.positionMs ? Math.max(0, params.positionMs) : 0;
  const maxProgressMs = Number.isFinite(params.maxProgressMs) && params.maxProgressMs ? Math.max(0, params.maxProgressMs) : 0;

  if (maxProgressMs >= thresholdMs) return true;

  return Boolean(params.firstPlayAt && positionMs >= thresholdMs);
}

function sanitizePlaybackMetadataValue(value: unknown, depth = 0): SanitizedPlaybackMetadataValue | undefined {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value.length > 500 ? value.substring(0, 500) : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return undefined;

  if (depth >= 3) return undefined;

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map(item => sanitizePlaybackMetadataValue(item, depth + 1))
      .filter((item): item is SanitizedPlaybackMetadataValue => item !== undefined);
  }

  return sanitizePlaybackMetadata(value, depth + 1);
}

function sanitizePlaybackMetadata(metadata: unknown, depth = 0): Record<string, SanitizedPlaybackMetadataValue> | undefined {
  if (!isMetadataRecord(metadata)) return undefined;

  const result: Record<string, SanitizedPlaybackMetadataValue> = {};
  const allowedKeys = Object.keys(metadata)
    .filter(key => !isForbiddenMetadataKey(key))
    .slice(0, 20);

  for (const key of allowedKeys) {
    const value = sanitizePlaybackMetadataValue(metadata[key], depth);
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
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

    const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);
    if (!accessResult.ok) {
        return { ok: false, error: accessResult.error };
    }

    const access = accessResult.data;
    if (!access.hasAccess && type !== 'ACCESS_ERROR') {
        return { ok: false, error: new PlaybackAccessDeniedError(access.reason) };
    }

    // Feeds the global Mux delivery circuit breaker (see mux-circuit-breaker.ts). Fire-and-forget:
    // it swallows its own errors and is a no-op unless MUX_GLOBAL_SOFT_LIMIT_PER_HOUR is
    // configured, so this never adds latency or a failure mode to normal playback-event recording.
    if (input.sourceKind === 'mux') {
        void recordGlobalMuxPlaybackEvent();
    }

    const repo = new VideoPlaybackRepository(rawPrisma);
    let session = null;

    if (sessionId) {
        session = await repo.findSessionById(sessionId);
        if (!session || session.videoId !== videoId) {
            return { ok: false, error: new InvalidPlaybackSessionError() };
        }

        if (userId) {
            if (session.userId && session.userId !== userId) {
                return { ok: false, error: new PlaybackSessionOwnershipMismatchError() };
            }
            if (!session.userId) {
                return { ok: false, error: new PlaybackSessionAnonymousForbiddenError() };
            }
        } else {
            if (session.userId) {
                 return { ok: false, error: new PlaybackSessionRequiresAuthError() };
            }
            if (session.ipHash !== ipHash || session.userAgentHash !== uaHash) {
                return { ok: false, error: new PlaybackSessionFingerprintMismatchError() };
            }
        }

        const currentTime = ctx.now ? ctx.now() : new Date();
        const sessionAgeMs = currentTime.getTime() - session.createdAt.getTime();
        if (sessionAgeMs > 24 * 60 * 60 * 1000) {
            return { ok: false, error: new PlaybackSessionExpiredError() };
        }
    } else if (['WATCHED_10_SECONDS', 'PROGRESS', 'HEARTBEAT'].includes(type)) {
        return { ok: false, error: new PlaybackSessionRequiredError() };
    }

    const isProgressOrHeartbeat = ['PROGRESS', 'HEARTBEAT'].includes(type);
    let shouldSaveEvent = true;

    if (sessionId && (isProgressOrHeartbeat || ['PLAY_STARTED', 'WATCHED_10_SECONDS'].includes(type))) {
        const now = ctx.now ? ctx.now() : new Date();
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

    let viewCounted = false;

    const hasCredibleWatchedEvidence = type === 'WATCHED_10_SECONDS' && session
        ? hasCredibleWatchedViewEvidence({
            positionMs,
            durationMs: durationMs || session.durationMs,
            firstPlayAt: session.firstPlayAt,
            maxProgressMs: session.maxProgressMs,
        })
        : false;

    if (type === 'WATCHED_10_SECONDS' && session && hasCredibleWatchedEvidence && !session.isAdminPreview && !session.countedAsView) {
        const identifier = userId ? `u:${userId}` : `f:${fingerprint}`;
        const lockKey = `video:view:${videoId}:${identifier}`;
        let isNewView = true;
        try {
          isNewView = await setNxEx(lockKey, '1', 86400);
        } catch {
          // Redis unavailable — proceed without deduplication guarantee
        }

        if (isNewView) {
            const recordViewResult = await db.writeTransaction(async (tx) => {
                const txRepo = new VideoPlaybackRepository(tx);
                return txRepo.recordView(videoId, sessionId!, userId, ipHash);
            });
            viewCounted = recordViewResult.counted;
        } else {
            await repo.markSessionAsViewed(sessionId!);
        }
    }

    return {
        ok: true,
        data: {
            success: true,
            throttled: isProgressOrHeartbeat && !shouldSaveEvent ? true : undefined,
            viewCounted: type === 'WATCHED_10_SECONDS' ? viewCounted : undefined
        }
    };
}
