'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

const RECOVERABLE_SESSION_ERRORS = [
    'SESSION_EXPIRED',
    'INVALID_SESSION',
    'SESSION_OWNERSHIP_MISMATCH',
    'SESSION_USER_MISMATCH',
    'SESSION_ANONYMOUS_FORBIDDEN',
    'SESSION_REQUIRES_AUTH',
];

interface PlaybackPositionSource {
    currentTime: number;
    duration: number;
}

export interface SendPlaybackEventResult {
    ok: boolean;
    viewCounted?: boolean;
}

export type SendPlaybackEvent = (
    type: string,
    extra?: Record<string, unknown>,
) => Promise<SendPlaybackEventResult>;

/**
 * Posts playback telemetry (heartbeats, progress, view events) for the active
 * playback session. On session-level 403s it renews the playback plan once,
 * silently (the server keeps the session when it may, or opens a new one; the
 * player is not remounted), and stops sending entirely after 3 consecutive
 * rejections — playback itself keeps working either way.
 */
export function usePlaybackTelemetry({
    videoId,
    playbackSessionId,
    renewPlaybackPlan,
    playerRef,
}: {
    videoId: string;
    playbackSessionId?: string;
    renewPlaybackPlan: () => unknown;
    playerRef: RefObject<PlaybackPositionSource | null>;
}): SendPlaybackEvent {
    const consecutiveFailures = useRef(0);
    const trackingDisabled = useRef(false);
    const sessionRecoveryAttempted = useRef(false);

    useEffect(() => {
        consecutiveFailures.current = 0;
        trackingDisabled.current = false;
    }, [videoId, playbackSessionId]);

    useEffect(() => {
        sessionRecoveryAttempted.current = false;
    }, [videoId]);

    return useCallback(async (type, extra = {}) => {
        if (!playbackSessionId || trackingDisabled.current) return { ok: false };
        try {
            const player = playerRef.current;
            const res = await fetch(`/api/videos/${videoId}/playback-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: playbackSessionId,
                    type,
                    positionMs: player ? Math.floor(player.currentTime * 1000) : 0,
                    durationMs: player ? Math.floor(player.duration * 1000) : 0,
                    ...extra,
                }),
            });

            if (res.status === 403) {
                consecutiveFailures.current += 1;
                const { error } = await res.json().catch(() => ({ error: null }));
                if (RECOVERABLE_SESSION_ERRORS.includes(error) && !sessionRecoveryAttempted.current) {
                    sessionRecoveryAttempted.current = true;
                    void renewPlaybackPlan();
                } else if (consecutiveFailures.current >= 3) {
                    trackingDisabled.current = true;
                }
                return { ok: false };
            }

            const data = await res.json().catch(() => ({}));
            if (res.ok) consecutiveFailures.current = 0;
            return { ok: res.ok, viewCounted: data?.viewCounted === true };
        } catch (e) {
            console.warn('Failed to send playback event', type, e);
            return { ok: false };
        }
    }, [videoId, playbackSessionId, renewPlaybackPlan, playerRef]);
}
