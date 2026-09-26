"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
    MediaPlayer,
    MediaProvider,
    type MediaPlayerInstance,
} from '@vidstack/react';
import PolutekControls from './player/PolutekControls';
import { useAuth } from "@clerk/nextjs";
import { useVideoAccess } from './PremiumWrapper';
import { PublicVideoDTO as VideoType, type VideoTextTrackDTO } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { PlayerErrorOverlay } from './PlayerErrorOverlay';
import { PlayerStateFrame } from './PlayerStateFrame';
import { PlayerPosterLoading } from './PlayerLoadingState';
import { resolvePlaybackSource } from './playback-source';
import { shouldSendViewForPlaybackPosition } from './video-view-threshold';
import { usePlaybackTelemetry } from '@/lib/hooks/usePlaybackTelemetry';
import { usePageRevealReady } from './preload/PageRevealGate';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
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

export default function VideoPlayer({ video, variant = 'hero', onViewCounted, revealKey }: VideoPlayerProps) {
    const { playbackPlan, refreshPlaybackPlan, isLoading } = useVideoAccess();
    const { orgRole } = useAuth();
    const isAdmin = orgRole === 'admin' || orgRole === 'org:admin';
    const [playerKey, setPlayerKey] = useState(0);
    const { source, tracking, player: playerConfig } = playbackPlan || {};
    const videoUrl = source?.playbackUrl;
    const videoSourceKind = source?.kind;
    const videoEmbedUrl = source?.embedUrl;
    const textTracks = normalizeTextTracks(playerConfig?.textTracks || video.textTracks);

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
    const hasReached10s = useRef(false);
    const viewCountRequestInFlight = useRef(false);
    const reachedThresholds = useRef<Record<number, boolean>>({});

    const sendEvent = usePlaybackTelemetry({
        videoId: video.id,
        playbackSessionId: tracking?.playbackSessionId,
        refreshPlaybackPlan,
        playerRef: player,
    });

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
        setLoadError(null);
        setPlayerKey((key) => key + 1);
        hasReached10s.current = false;
        viewCountRequestInFlight.current = false;
        reachedThresholds.current = {};
    }, [video.id, videoUrl, videoEmbedUrl, videoSourceKind, tracking?.playbackSessionId]);

    useEffect(() => {
        setBufferingOverlayTimedOut(false);
        const timer = setTimeout(() => setBufferingOverlayTimedOut(true), 15000);
        return () => clearTimeout(timer);
    }, [video.id, videoUrl, videoEmbedUrl, videoSourceKind]);

    useEffect(() => {
        if (!isMounted || !tracking?.playbackSessionId) return;
        const interval = setInterval(() => {
            if (player.current?.paused === false) sendEvent('HEARTBEAT');
        }, (tracking.heartbeatIntervalSeconds || 15) * 1000);
        return () => clearInterval(interval);
    }, [isMounted, tracking, sendEvent]);

    const autoPlayWanted = playerConfig ? (playerConfig.autoplayAllowed && playerConfig.mutedAutoplay) : variant === 'hero';
    const resolvedSource = resolvePlaybackSource({
        kind: videoSourceKind,
        playbackUrl: videoUrl,
        embedUrl: videoEmbedUrl,
    });
    const showsErrorState = isMounted && !isLoading && (!playbackPlan || resolvedSource.mode === 'unavailable');
    // Settled = what the viewer should see from now on is already on screen: a playing
    // frame, or (no autoplay / autoplay blocked) the ready, paused player. The first-load
    // preloader waits for this, so the page is revealed with the player already stable
    // instead of switching from poster to video right after the reveal.
    const playbackSettled = hasRenderedFrame || (canPlay && (!autoPlayWanted || autoPlayFailed));
    usePageRevealReady(revealKey, playbackSettled || !!loadError || bufferingOverlayTimedOut || showsErrorState);

    // PremiumWrapper owns the loading placeholder before this mounts. For the one
    // pre-mount frame here, keep showing the same poster rather than an empty (black)
    // box, so the handoff from PremiumWrapper to the player never flashes.
    if (!isMounted || isLoading) {
        if (variant === 'thumbnail') return null;
        return (
            <div className="relative h-full w-full">
                <PlayerPosterLoading posterUrl={video.thumbnailUrl || posterUrl} />
            </div>
        );
    }

    if (variant === 'thumbnail') {
        return (
            <div className={cn("relative w-full h-full group/player overflow-hidden bg-neutral-900", "cursor-default")}>
                <Image
                    src={posterUrl}
                    alt={video.title || 'Video poster'}
                    fill
                    className="w-full h-full object-cover opacity-90 transition duration-700 group-hover/player:scale-105"
                />
                {!videoUrl && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/player:opacity-100 transition-opacity">
                        <span className="text-white font-mono text-[10px] uppercase tracking-widest bg-black/60 px-4 py-2 border border-white/20">Access Restricted</span>
                    </div>
                )}
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

    const src = resolvedSource.src;

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
                        muted={playerConfig ? playerConfig.mutedAutoplay : variant === 'hero'}
                        autoPlay={autoPlayWanted}
                        preload={autoPlayWanted ? 'auto' : undefined}
                        playsInline
                        aspectRatio="16/9"
                        controlsDelay={4000}
                        onCanPlay={() => {
                            setCanPlay(true);
                            if (player.current?.muted && typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive) {
                                player.current.muted = false;
                            }
                            sendEvent('PLAYER_READY');
                        }}
                        onPlay={() => {
                            if (!hasStartedPlayback) {
                                setHasStartedPlayback(true);
                                sendEvent('PLAY_STARTED');
                            }
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
                        onError={() => {
                            setLoadError('Nie udało się załadować materiału wideo. Sprawdź link, CORS lub dostępność źródła.');
                            sendEvent('PLAYER_ERROR', { errorCode: 'LOAD_FAILED' });
                        }}
                    >
                        <MediaProvider>
                            {textTracks.map((track) => (
                                <track
                                    key={`${track.kind}:${track.language}:${track.label}:${track.src}`}
                                    src={track.src}
                                    kind={track.kind}
                                    label={track.label}
                                    srcLang={track.language}
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
                                hidden={playbackSettled}
                                ready={canPlay}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
