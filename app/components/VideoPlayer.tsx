"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    MediaPlayer,
    MediaProvider,
    Track,
    isHLSProvider,
    type MediaPlayerInstance,
    type MediaProviderAdapter,
} from '@vidstack/react';
import PolutekControls from './player/PolutekControls';
import { useVideoAccess } from './PremiumWrapper';
import { PublicVideoDTO as VideoType, type VideoTextTrackDTO } from '@/app/types/video';
import { PlayerErrorOverlay } from './PlayerErrorOverlay';
import { PlayerStateFrame } from './PlayerStateFrame';
import { PlayerPosterLoading } from './PlayerLoadingState';
import { resolvePlaybackSource } from './playback-source';
import { shouldSendViewForPlaybackPosition } from './video-view-threshold';
import { usePlaybackTelemetry } from '@/lib/hooks/usePlaybackTelemetry';
import { usePageRevealReady } from './preload/PageRevealGate';
import { buildSelfHlsConfig, loadHlsLibrary, streamIdentity } from './player/self-hls';

// The player is on the home page above the fold: start fetching hls.js (our own chunk) right
// away, so it is ready before the playback plan arrives and the stream is never fetched twice
// (natively by the <video> element and again by hls.js).
if (typeof window !== 'undefined') void loadHlsLibrary().catch(() => undefined);

/** Renew the delivery token before a request when it expires within this window. */
const TOKEN_RENEW_BEFORE_MS = 30_000;
/** Longest a request waits for a token renewal before going out anyway. */
const TOKEN_RENEW_WAIT_MS = 10_000;

interface VideoPlayerProps {
    video: VideoType;
    onViewCounted?: () => void;
    /** PageRevealGate key to report once the stream can play (first frames buffered). */
    revealKey?: string;
}


function normalizeTextTracks(tracks: VideoTextTrackDTO[] | undefined): VideoTextTrackDTO[] {
    if (!Array.isArray(tracks)) return [];

    return tracks.filter((track) => {
        const src = track.src?.trim();
        const label = track.label?.trim();
        const language = track.language?.trim();
        return Boolean(src && label && language && (track.kind === 'subtitles' || track.kind === 'captions'));
    });
}

export default function VideoPlayer({ video, onViewCounted, revealKey }: VideoPlayerProps) {
    const { playbackPlan, refreshPlaybackPlan, renewPlaybackPlan, isLoading } = useVideoAccess();
    // The player never receives admin status from the session (the server decides); admin-only
    // diagnostics in the overlays stay off for viewers.
    const isAdmin = false;
    const [playerKey, setPlayerKey] = useState(0);
    const { source, tracking, player: playerConfig } = playbackPlan || {};
    const videoUrl = source?.playbackUrl;
    const videoSourceKind = source?.kind;
    const textTracks = normalizeTextTracks(playerConfig?.textTracks);

    // One stream = one video version; a renewed token is the same stream. The player is mounted
    // with the URL it started with; later requests get the newest token (see player/self-hls.ts).
    const streamKey = streamIdentity(videoUrl);
    const [mountedStream, setMountedStream] = useState<{ key: string | null; url: string | undefined }>({ key: streamKey, url: videoUrl });
    if (mountedStream.key !== streamKey) setMountedStream({ key: streamKey, url: videoUrl });
    const latestUrlRef = useRef(videoUrl);
    const tokenExpiresAtRef = useRef<number | null>(null);
    const renewRef = useRef(renewPlaybackPlan);
    useEffect(() => {
        latestUrlRef.current = videoUrl;
        tokenExpiresAtRef.current = source?.expiresAt ? new Date(source.expiresAt).getTime() : null;
        renewRef.current = renewPlaybackPlan;
    }, [videoUrl, source?.expiresAt, renewPlaybackPlan]);
    // After a fatal error the stream is reloaded once with a fresh token, from the same position.
    const recoveryAttemptedRef = useRef(false);
    const resumeRef = useRef<{ time: number; play: boolean } | null>(null);
    const playStartedSentRef = useRef(false);

    const player = useRef<MediaPlayerInstance>(null);
    const posterUrl = playerConfig?.poster || source?.posterUrl || video.thumbnailUrl || '/logo.png';
    const [isMounted, setIsMounted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
    const [bufferingOverlayTimedOut, setBufferingOverlayTimedOut] = useState(false);
    const [canPlay, setCanPlay] = useState(false);
    // `play` fires when playback is requested, before a frame is on screen; the poster
    // overlay must stay until a frame actually renders, or the gap shows as a black
    // flash. `hasRenderedFrame` tracks the real first frame (`playing` / time > 0).
    const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
    const [autoPlayFailed, setAutoPlayFailed] = useState(false);
    // True once the browser has buffered at least TARGET_BUFFER_SECONDS of video.
    // The preloader waits for this alongside the first rendered frame so the page
    // is revealed onto a player that already has a few seconds queued.
    const TARGET_BUFFER_SECONDS = 3;
    const [bufferedEnoughForReveal, setBufferedEnoughForReveal] = useState(false);
    const bufferedEnoughRef = useRef(false);
    const hasReached10s = useRef(false);
    const viewCountRequestInFlight = useRef(false);
    const reachedThresholds = useRef<Record<number, boolean>>({});

    const sendEvent = usePlaybackTelemetry({
        videoId: video.id,
        playbackSessionId: tracking?.playbackSessionId,
        renewPlaybackPlan,
        playerRef: player,
    });

    // Token handling for hls.js requests: renew first when the token is about to expire (a tab
    // that slept for hours), and renew at once when the edge refused a request (401/403).
    const ensureFreshToken = useCallback(async () => {
        const expiresAt = tokenExpiresAtRef.current;
        if (!expiresAt || expiresAt - Date.now() > TOKEN_RENEW_BEFORE_MS) return;
        await Promise.race([
            renewRef.current().catch(() => null),
            new Promise((resolve) => setTimeout(resolve, TOKEN_RENEW_WAIT_MS)),
        ]);
    }, []);
    const onDeliveryAuthError = useCallback(() => {
        void renewRef.current().catch(() => null);
    }, []);

    const handleProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
        if (!isHLSProvider(provider) || videoSourceKind !== 'self_hls') return;
        // Our own pinned hls.js chunk, never the CDN default. Must be an arrow function: Vidstack
        // treats anything with a prototype as the hls.js class itself.
        provider.library = async () => {
            const mod = await loadHlsLibrary();
            provider.config = buildSelfHlsConfig({
                defaults: mod.default.DefaultConfig,
                currentMasterUrl: () => latestUrlRef.current,
                ensureFreshToken,
                onAuthError: onDeliveryAuthError,
                connection: (navigator as Navigator & { connection?: Parameters<typeof buildSelfHlsConfig>[0]['connection'] }).connection,
            });
            return mod;
        };
    }, [ensureFreshToken, onDeliveryAuthError, videoSourceKind]);

    const handleMediaError = useCallback(async () => {
        if (!recoveryAttemptedRef.current) {
            // Typical cause: the token expired while the tab slept and the edge answered 403.
            // Renew silently and reload the stream from the same position, once.
            recoveryAttemptedRef.current = true;
            const current = player.current;
            resumeRef.current = current ? { time: current.currentTime || 0, play: current.paused === false } : null;
            const fresh = await renewRef.current().catch(() => null);
            const freshUrl = fresh?.source?.playbackUrl;
            if (freshUrl && streamIdentity(freshUrl) === streamKey) {
                setMountedStream({ key: streamKey, url: freshUrl });
                setPlayerKey((key) => key + 1);
                return;
            }
        }
        resumeRef.current = null;
        setLoadError('Nie udało się załadować materiału wideo. Spróbuj ponownie za chwilę.');
        sendEvent('PLAYER_ERROR', { errorCode: 'LOAD_FAILED' });
    }, [sendEvent, streamKey]);

    const maybeSendView = useCallback(async (currentTimeSeconds: number, durationSeconds?: number) => {
        if (hasReached10s.current || viewCountRequestInFlight.current || !shouldSendViewForPlaybackPosition(currentTimeSeconds, durationSeconds)) return;

        viewCountRequestInFlight.current = true;
        const durationMs = Number.isFinite(durationSeconds) && durationSeconds && durationSeconds > 0
            ? Math.floor(durationSeconds * 1000)
            : 0;
        const result = await sendEvent('WATCHED_10_SECONDS', {
            positionMs: Math.floor(Math.max(0, currentTimeSeconds) * 1000),
            durationMs,
        });

        if (result.ok) {
            hasReached10s.current = true;
            if (result.viewCounted) onViewCounted?.();
        }

        viewCountRequestInFlight.current = false;
    }, [onViewCounted, sendEvent]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        setHasStartedPlayback(false);
        setCanPlay(false);
        setHasRenderedFrame(false);
        setAutoPlayFailed(false);
        setBufferedEnoughForReveal(false);
        bufferedEnoughRef.current = false;
        setLoadError(null);
        setPlayerKey((key) => key + 1);
        hasReached10s.current = false;
        viewCountRequestInFlight.current = false;
        reachedThresholds.current = {};
        recoveryAttemptedRef.current = false;
        resumeRef.current = null;
        playStartedSentRef.current = false;
        // Only a different video/version restarts the player; a renewed token or session does not.
    }, [video.id, streamKey]);

    useEffect(() => {
        setBufferingOverlayTimedOut(false);
        const timer = setTimeout(() => setBufferingOverlayTimedOut(true), 15000);
        return () => clearTimeout(timer);
    }, [video.id, streamKey]);

    useEffect(() => {
        if (!isMounted || !tracking?.playbackSessionId) return;
        const interval = setInterval(() => {
            if (player.current?.paused === false) sendEvent('HEARTBEAT');
        }, (tracking.heartbeatIntervalSeconds || 15) * 1000);
        return () => clearInterval(interval);
    }, [isMounted, tracking, sendEvent]);

    const autoPlayWanted = playerConfig ? (playerConfig.autoplayAllowed && playerConfig.mutedAutoplay) : true;
    const resolvedSource = resolvePlaybackSource({
        kind: videoSourceKind,
        playbackUrl: videoUrl,
    });
    const showsErrorState = isMounted && !isLoading && (!playbackPlan || resolvedSource.mode === 'unavailable');
    // Settled = what the viewer should see from now on is already on screen: a playing
    // frame, or (no autoplay / autoplay blocked) the ready, paused player. The first-load
    // preloader waits for this, so the page is revealed with the player already stable
    // instead of switching from poster to video right after the reveal.
    // When autoplay is running we also require a few seconds of video buffered so the
    // page is revealed onto a player that won't stall immediately (falls back via
    // bufferingOverlayTimedOut / PAGE_REVEAL_MAX_WAIT_MS if buffering is slow).
    // Gate: preloader stays up until the stream has a few seconds buffered (or falls
    // back). Requires bufferedEnoughForReveal when autoplaying so the page is revealed
    // onto a player that won't stall immediately.
    const playbackSettled =
        (hasRenderedFrame && (!autoPlayWanted || bufferedEnoughForReveal)) ||
        (canPlay && (!autoPlayWanted || autoPlayFailed));
    usePageRevealReady(revealKey, playbackSettled || !!loadError || bufferingOverlayTimedOut || showsErrorState);

    // When the rabbit gate is clicked, restart the video from the beginning so
    // the viewer always sees it from 0, not from wherever it buffered to.
    useEffect(() => {
        const handleGateEnter = () => {
            if (player.current) {
                player.current.currentTime = 0;
                player.current.muted = false;
            }
        };
        window.addEventListener("polutek:gate-enter", handleGateEnter);
        return () => window.removeEventListener("polutek:gate-enter", handleGateEnter);
    }, []);
    // Poster: hides as soon as the first frame renders — independent of buffering so
    // the cover photo doesn't linger for the full buffer-wait period after the reveal.
    const posterHidden =
        hasRenderedFrame ||
        (canPlay && (!autoPlayWanted || autoPlayFailed));

    // PremiumWrapper owns the loading placeholder before this mounts. For the one
    // pre-mount frame here, keep showing the same poster rather than an empty (black)
    // box, so the handoff from PremiumWrapper to the player never flashes.
    if (!isMounted || isLoading) {
        return (
            <div className="relative h-full w-full">
                <PlayerPosterLoading posterUrl={video.thumbnailUrl || posterUrl} />
            </div>
        );
    }

    if (!playbackPlan) {
        return (
            <PlayerStateFrame>
                <PlayerErrorOverlay errorCode="NO_PLAYBACK_PLAN" onRetry={() => refreshPlaybackPlan()} isAdmin={isAdmin} />
            </PlayerStateFrame>
        );
    }

    if (resolvedSource.mode === 'unavailable') {
        const errorCode = resolvedSource.reason.startsWith('missing') ? 'NO_PLAYBACK_URL' : 'UNSUPPORTED_SOURCE';
        return (
            <PlayerStateFrame>
                <PlayerErrorOverlay errorCode={errorCode} onRetry={() => refreshPlaybackPlan()} isAdmin={isAdmin} />
            </PlayerStateFrame>
        );
    }

    // The URL the stream was mounted with (a renewed token alone never reloads it).
    const src = mountedStream.key === streamKey && mountedStream.url ? mountedStream.url : resolvedSource.src;

    return (
        <div className="relative h-full w-full min-h-0 overflow-hidden rounded-[18px] border border-black/10 bg-black shadow-[0_18px_48px_rgba(15,23,42,0.16)] sm:min-h-[220px]">
            {loadError ? (
                <PlayerErrorOverlay
                    errorCode="MEDIA_LOAD_FAILED"
                    onRetry={() => {
                        setLoadError(null);
                        setHasStartedPlayback(false);
                        setPlayerKey((key) => key + 1);
                        refreshPlaybackPlan?.();
                    }}
                    isAdmin={isAdmin}
                />
            ) : (
                <div className="relative h-full w-full">
                    <MediaPlayer
                        key={playerKey}
                        ref={player}
                        className="polutek-vidstack-player h-full w-full"
                        title={playerConfig?.title || video.title || 'Video'}
                        src={src}
                        muted={playerConfig ? playerConfig.mutedAutoplay : true}
                        autoPlay={autoPlayWanted}
                        preload={autoPlayWanted ? 'auto' : undefined}
                        playsInline
                        aspectRatio="16/9"
                        controlsDelay={4000}
                        onCanPlay={() => {
                            setCanPlay(true);
                            const resume = resumeRef.current;
                            if (resume && player.current) {
                                resumeRef.current = null;
                                if (resume.time > 0) player.current.currentTime = resume.time;
                                if (resume.play) void player.current.play().catch(() => undefined);
                            }
                            if (player.current?.muted && typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive) {
                                player.current.muted = false;
                            }
                            sendEvent('PLAYER_READY');
                            // Check buffered amount immediately at canPlay too.
                            if (!bufferedEnoughRef.current) {
                                try {
                                    const buf = (player.current as unknown as { buffered?: TimeRanges } | null)?.buffered;
                                    if (buf && buf.length > 0 && buf.end(0) >= TARGET_BUFFER_SECONDS) {
                                        bufferedEnoughRef.current = true;
                                        setBufferedEnoughForReveal(true);
                                    }
                                } catch {}
                            }
                        }}
                        onProgress={() => {
                            if (bufferedEnoughRef.current) return;
                            try {
                                const buf = (player.current as unknown as { buffered?: TimeRanges } | null)?.buffered;
                                if (buf && buf.length > 0 && buf.end(0) >= TARGET_BUFFER_SECONDS) {
                                    bufferedEnoughRef.current = true;
                                    setBufferedEnoughForReveal(true);
                                }
                            } catch {}
                        }}
                        onPlay={() => {
                            setHasStartedPlayback(true);
                            // First play starts the watch clock, every later play resumes it
                            // (the server counts watch time between these and HEARTBEAT/PAUSE).
                            sendEvent(playStartedSentRef.current ? 'PLAY_RESUMED' : 'PLAY_STARTED');
                            playStartedSentRef.current = true;
                        }}
                        onPause={() => sendEvent('PLAY_PAUSED')}
                        onEnded={() => {
                            void sendEvent('ENDED');
                            if (player.current) void maybeSendView(player.current.currentTime, player.current.duration);
                        }}
                        onSeeked={(event: any) => {
                            const detailTime = typeof event.detail === 'number' ? event.detail : event.detail?.currentTime;
                            const currentTime = Number.isFinite(detailTime) ? detailTime : player.current?.currentTime || 0;
                            sendEvent('SEEKED', { positionMs: Math.floor(currentTime * 1000) });
                        }}
                        onWaiting={() => sendEvent('BUFFERING_STARTED')}
                        onAutoPlayFail={() => setAutoPlayFailed(true)}
                        onPlaying={() => {
                            setHasStartedPlayback(true);
                            setHasRenderedFrame(true);
                            recoveryAttemptedRef.current = false;
                            sendEvent('BUFFERING_ENDED');
                        }}
                        onTimeUpdate={(event: any) => {
                            const detail = typeof event.detail === 'number'
                                ? { currentTime: event.detail, duration: player.current?.duration }
                                : event.detail || {};
                            const currentTime = Number.isFinite(detail.currentTime) ? detail.currentTime : player.current?.currentTime || 0;
                            const duration = Number.isFinite(detail.duration) ? detail.duration : player.current?.duration;
                            if (currentTime > 0 && !hasStartedPlayback) setHasStartedPlayback(true);
                            if (currentTime > 0 && !hasRenderedFrame) setHasRenderedFrame(true);

                            void maybeSendView(currentTime, duration);

                            const pct = duration ? (currentTime / duration) * 100 : 0;
                            const thresholds = [
                                { pct: 25, type: 'WATCHED_25_PERCENT' },
                                { pct: 50, type: 'WATCHED_50_PERCENT' },
                                { pct: 75, type: 'WATCHED_75_PERCENT' },
                                { pct: 90, type: 'WATCHED_90_PERCENT' },
                            ];

                            for (const threshold of thresholds) {
                                if (pct >= threshold.pct && !reachedThresholds.current[threshold.pct]) {
                                    reachedThresholds.current[threshold.pct] = true;
                                    sendEvent(threshold.type);
                                }
                            }
                        }}
                        onProviderChange={handleProviderChange}
                        onError={() => void handleMediaError()}
                    >
                        <MediaProvider>
                            {textTracks.map((track) => (
                                <Track
                                    key={`${track.kind}:${track.language}:${track.label}:${track.src}`}
                                    src={track.src}
                                    kind={track.kind}
                                    label={track.label}
                                    language={track.language}
                                    type="vtt"
                                    default={track.default}
                                />
                            ))}
                        </MediaProvider>
                        {(playerConfig ? playerConfig.controls : true) && <PolutekControls />}
                    </MediaPlayer>
                    {!bufferingOverlayTimedOut && (
                        // Same poster the access-check state showed (video.thumbnailUrl), so
                        // the handoff from PremiumWrapper to the mounted player is seamless;
                        // it fades out on the first real frame instead of cutting away.
                        <div className="absolute inset-0 z-30 pointer-events-none">
                            <PlayerPosterLoading
                                posterUrl={video.thumbnailUrl || posterUrl}
                                hidden={posterHidden}
                                ready={canPlay}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
