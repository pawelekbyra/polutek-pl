"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
    CaptionButton,
    Captions,
    Controls,
    FullscreenButton,
    MediaPlayer,
    MediaProvider,
    MuteButton,
    PlayButton,
    Poster,
    Time,
    TimeSlider,
    VolumeSlider,
    isTrackCaptionKind,
    useMediaState,
    type MediaPlayerInstance,
} from '@vidstack/react';
import { useAuth } from "@clerk/nextjs";
import { useVideoAccess } from './PremiumWrapper';
import { PublicVideoDTO as VideoType, type VideoTextTrackDTO } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { CaptionsIcon, Maximize, Pause, Play, Settings, Volume2, VolumeX } from 'lucide-react';
import { PlayerErrorOverlay } from './PlayerErrorOverlay';
import { PlayerStateFrame } from './PlayerStateFrame';
import { resolvePlaybackSource } from './playback-source';
import { shouldSendViewForPlaybackPosition } from './video-view-threshold';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
    onViewCounted?: () => void;
}

const playerIconClass = "h-5 w-5 stroke-[2]";

function PolutekWatermark() {
    return (
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex h-11 w-11 rotate-3 items-center justify-center rounded-[1.15rem] border-2 border-sky-300/80 bg-white/88 text-2xl font-black italic text-sky-600 shadow-[3px_4px_0_rgba(14,165,233,0.28)] ring-1 ring-white/60 backdrop-blur-sm sm:right-5 sm:top-5">
            <span className="-translate-y-0.5 font-serif drop-shadow-[1px_1px_0_rgba(255,255,255,0.95)]">P</span>
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-300 shadow-sm" />
        </div>
    );
}

function PlayerPlayButton({ className }: { className: string }) {
    const paused = useMediaState('paused');

    return (
        <PlayButton className={className} aria-label={paused ? "Odtwórz" : "Pauza"}>
            {paused ? <Play className={playerIconClass} aria-hidden="true" fill="currentColor" /> : <Pause className={playerIconClass} aria-hidden="true" fill="currentColor" />}
        </PlayButton>
    );
}

function PlayerMuteIcon() {
    const muted = useMediaState('muted');
    const volume = useMediaState('volume');
    const Icon = muted || volume === 0 ? VolumeX : Volume2;

    return <Icon className={playerIconClass} aria-hidden="true" />;
}

function PlayerCaptionButton({ className }: { className: string }) {
    const textTrack = useMediaState('textTrack');
    const captionsOn = Boolean(textTrack && isTrackCaptionKind(textTrack));

    return (
        <CaptionButton
            className={cn(className, captionsOn && "bg-[#ff2d2d] text-white hover:bg-[#ff2d2d]/90 active:bg-[#ff2d2d]/85")}
            aria-label={captionsOn ? "Wyłącz napisy" : "Włącz napisy"}
            aria-pressed={captionsOn}
        >
            <CaptionsIcon className={playerIconClass} aria-hidden="true" />
        </CaptionButton>
    );
}

function PolutekVideoControls({ hasTextTracks }: { hasTextTracks: boolean }) {
    const buttonClass = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/12 hover:text-white active:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d2d]/80 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11";

    return (
        <Controls.Root className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[visible]:opacity-100 sm:px-4">
            <TimeSlider.Root className="group/time relative flex h-8 w-full cursor-pointer touch-none select-none items-center" aria-label="Postęp filmu">
                <TimeSlider.Track className="relative h-1 w-full overflow-hidden rounded-full bg-white/30 transition-[height] group-hover/time:h-1.5 group-focus-within/time:h-1.5 data-[dragging]:h-1.5">
                    <TimeSlider.Progress className="absolute h-full rounded-full bg-white/35" />
                    <TimeSlider.TrackFill className="absolute h-full rounded-full bg-[#ff2d2d]" />
                </TimeSlider.Track>
                <TimeSlider.Thumb className="absolute left-[var(--slider-fill)] top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff2d2d] shadow-md ring-2 ring-white/80 transition-transform group-hover/time:scale-110 group-focus-within/time:scale-110 data-[dragging]:scale-125" />
            </TimeSlider.Root>

            <Controls.Group className="mt-1 flex h-11 min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <PlayerPlayButton className={buttonClass} />

                    <div className="flex shrink-0 items-center gap-1">
                        <MuteButton className={buttonClass} aria-label="Wycisz / włącz dźwięk"><PlayerMuteIcon /></MuteButton>
                        <VolumeSlider.Root className="relative hidden h-9 w-20 items-center md:flex lg:w-24" aria-label="Głośność">
                            <VolumeSlider.Track className="relative h-1 w-full rounded-full bg-white/30 transition-[height] focus-within:h-1.5">
                                <VolumeSlider.TrackFill className="absolute h-full rounded-full bg-[#ff2d2d]" />
                            </VolumeSlider.Track>
                            <VolumeSlider.Thumb className="absolute left-[var(--slider-fill)] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff2d2d] ring-2 ring-white/80 transition-transform data-[dragging]:scale-110" />
                        </VolumeSlider.Root>
                    </div>

                    <div className="whitespace-nowrap text-sm font-medium tabular-nums text-white/90">
                        <Time type="current" /> <span className="text-white/60">/</span> <span className="text-white/75"><Time type="duration" /></span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                    {hasTextTracks && <PlayerCaptionButton className={buttonClass} />}
                    <button className={buttonClass} type="button" aria-label="Ustawienia odtwarzacza" disabled title="Ustawienia będą dostępne w kolejnym kroku">
                        <Settings className={playerIconClass} aria-hidden="true" />
                    </button>
                    <FullscreenButton className={buttonClass} aria-label="Pełny ekran"><Maximize className={playerIconClass} aria-hidden="true" /></FullscreenButton>
                </div>
            </Controls.Group>
        </Controls.Root>
    );
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

export default function VideoPlayer({ video, variant = 'hero', onViewCounted }: VideoPlayerProps) {
    const { playbackPlan, refreshPlaybackPlan, isLoading } = useVideoAccess();
    const { orgRole } = useAuth();
    const isAdmin = orgRole === 'admin' || orgRole === 'org:admin';
    const [playerKey, setPlayerKey] = useState(0);
    const { source, tracking, player: playerConfig } = playbackPlan || {};
    const videoUrl = source?.playbackUrl;
    const videoSourceKind = source?.kind;
    const videoEmbedUrl = source?.embedUrl;
    const textTracks = normalizeTextTracks(playerConfig?.textTracks || video.textTracks);
    const hasTextTracks = textTracks.length > 0;

    const player = useRef<MediaPlayerInstance>(null);
    const posterUrl = playerConfig?.poster || video.thumbnailUrl || '/logo.png';
    const [isMounted, setIsMounted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
    const hasReached10s = useRef(false);
    const cloudflareViewFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reachedThresholds = useRef<Record<number, boolean>>({});

    const sendEvent = useCallback(async (type: string, extra = {}): Promise<boolean> => {
        if (!tracking?.playbackSessionId) return false;
        try {
            const res = await fetch(`/api/videos/${video.id}/playback-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: tracking.playbackSessionId,
                    type,
                    positionMs: player.current ? Math.floor(player.current.currentTime * 1000) : 0,
                    durationMs: player.current ? Math.floor(player.current.duration * 1000) : 0,
                    ...extra
                })
            });

            if (res.status === 403) {
                const { error } = await res.json();
                if (error === 'SESSION_EXPIRED') {
                    refreshPlaybackPlan();
                }
                return false;
            }

            return res.ok;
        } catch (e) {
            console.warn("Failed to send playback event", type, e);
            return false;
        }
    }, [video.id, tracking?.playbackSessionId, refreshPlaybackPlan]);

    const clearCloudflareViewFallback = useCallback(() => {
        if (cloudflareViewFallbackTimer.current) {
            clearTimeout(cloudflareViewFallbackTimer.current);
            cloudflareViewFallbackTimer.current = null;
        }
    }, []);

    const maybeSendView = useCallback(async (currentTimeSeconds: number, durationSeconds?: number) => {
        if (hasReached10s.current || !shouldSendViewForPlaybackPosition(currentTimeSeconds, durationSeconds)) return;

        hasReached10s.current = true;
        const durationMs = Number.isFinite(durationSeconds) && durationSeconds && durationSeconds > 0
            ? Math.floor(durationSeconds * 1000)
            : 0;
        const counted = await sendEvent('WATCHED_10_SECONDS', {
            positionMs: Math.floor(Math.max(0, currentTimeSeconds) * 1000),
            durationMs,
        });

        if (counted) {
            onViewCounted?.();
        }
    }, [onViewCounted, sendEvent]);

    const sendWatched10Seconds = useCallback(() => {
        void maybeSendView(10);
    }, [maybeSendView]);

    const scheduleCloudflareViewFallback = useCallback(() => {
        clearCloudflareViewFallback();
        cloudflareViewFallbackTimer.current = setTimeout(sendWatched10Seconds, 10000);
    }, [clearCloudflareViewFallback, sendWatched10Seconds]);

    useEffect(() => {
        return clearCloudflareViewFallback;
    }, [clearCloudflareViewFallback, playerKey, tracking?.playbackSessionId]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        setHasStartedPlayback(false);
        hasReached10s.current = false;
        reachedThresholds.current = {};
        clearCloudflareViewFallback();
    }, [video.id, videoUrl, videoEmbedUrl, videoSourceKind, tracking?.playbackSessionId, clearCloudflareViewFallback]);

    useEffect(() => {
        if (!isMounted || !tracking?.playbackSessionId) return;
        const interval = setInterval(() => {
            if (player.current?.paused === false) {
                sendEvent('HEARTBEAT');
            }
        }, (tracking.heartbeatIntervalSeconds || 15) * 1000);
        return () => clearInterval(interval);
    }, [isMounted, tracking, sendEvent]);

    // PremiumWrapper owns the single player loading placeholder. Avoid adding a nested skeleton here.
    if (!isMounted || isLoading) {
        return null;
    }

    // Optimized Thumbnail Variant: No player engine, just a static preview
    if (variant === 'thumbnail') {
        return (
            <div
                className={cn(
                    "relative w-full h-full group/player overflow-hidden bg-neutral-900",
                    "cursor-default"
                )}
            >
                <Image
                    src={posterUrl}
                    alt={video.title || 'Video poster'}
                    fill
                    className="w-full h-full object-cover opacity-90 transition duration-700 group-hover/player:scale-105"
                />
                {!videoUrl && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/player:opacity-100 transition-opacity">
                        <span className="text-white font-mono text-[10px] uppercase tracking-widest bg-black/60 px-4 py-2 border border-white/20">
                            Access Restricted
                        </span>
                    </div>
                )}
            </div>
        );
    }

    if (!playbackPlan) {
        return (
            <PlayerStateFrame>
                <PlayerErrorOverlay
                    errorCode="NO_PLAYBACK_PLAN"
                    onRetry={() => refreshPlaybackPlan()}
                    isAdmin={isAdmin}
                />
            </PlayerStateFrame>
        );
    }

    const resolvedSource = resolvePlaybackSource({
        kind: videoSourceKind,
        playbackUrl: videoUrl,
        embedUrl: videoEmbedUrl,
    });

    if (resolvedSource.mode === 'unavailable') {
        const errorCode = resolvedSource.reason.startsWith('missing') ? 'NO_PLAYBACK_URL' : 'UNSUPPORTED_SOURCE';

        return (
            <PlayerStateFrame>
                <PlayerErrorOverlay
                    errorCode={errorCode}
                    onRetry={() => refreshPlaybackPlan()}
                    isAdmin={isAdmin}
                />
            </PlayerStateFrame>
        );
    }

    const src = resolvedSource.src;

    if (resolvedSource.mode === 'cloudflare-iframe-fallback') {
        return (
            <div className="relative w-full h-full min-h-0 sm:min-h-[220px] bg-black rounded-xl overflow-hidden shadow-2xl group">
                <PolutekWatermark />
                {loadError ? (
                    <PlayerErrorOverlay
                        errorCode="MEDIA_LOAD_FAILED"
                        onRetry={() => {
                            clearCloudflareViewFallback();
                            setLoadError(null);
                            refreshPlaybackPlan?.();
                        }}
                        isAdmin={isAdmin}
                    />
                ) : (
                    <iframe
                        key={playerKey}
                        className="h-full w-full border-0"
                        src={src}
                        title={playerConfig?.title || video.title || 'Video'}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        onLoad={() => {
                            sendEvent('PLAYER_READY');
                            scheduleCloudflareViewFallback();
                        }}
                        onError={() => {
                            clearCloudflareViewFallback();
                            setLoadError('Nie udało się załadować materiału wideo. Sprawdź dostępność źródła.');
                            setPlayerKey((k) => k + 1);
                            sendEvent('PLAYER_ERROR', { errorCode: 'LOAD_FAILED' });
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="relative w-full h-full min-h-0 sm:min-h-[220px] bg-black rounded-xl overflow-hidden shadow-2xl group">
            <PolutekWatermark />
            {loadError ? (
                <PlayerErrorOverlay
                    errorCode="MEDIA_LOAD_FAILED"
                    onRetry={() => {
                        setLoadError(null);
                        setHasStartedPlayback(false);
                        setPlayerKey((k) => k + 1);
                        refreshPlaybackPlan?.();
                    }}
                    isAdmin={isAdmin}
                />
            ) : (
                <MediaPlayer
                    key={playerKey}
                    ref={player}
                    className="h-full w-full bg-black text-white [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_iframe]:h-full [&_iframe]:w-full"
                    title={playerConfig?.title || video.title || 'Video'}
                    src={src}
                    poster={posterUrl}
                    muted={playerConfig ? playerConfig.mutedAutoplay : variant === 'hero'}
                    autoPlay={playerConfig ? (playerConfig.autoplayAllowed && playerConfig.mutedAutoplay) : variant === 'hero'}
                    playsInline
                    controls={false}
                    aspectRatio="16/9"
                    onCanPlay={() => sendEvent('PLAYER_READY')}
                    onPlay={() => {
                        setHasStartedPlayback(true);
                        sendEvent('PLAY_STARTED');
                    }}
                    onPause={() => sendEvent('PLAY_PAUSED')}
                    onEnded={() => {
                        void sendEvent('ENDED');
                        if (player.current) {
                            void maybeSendView(player.current.currentTime, player.current.duration);
                        }
                    }}
                    onSeeked={(e: any) => sendEvent('SEEKED', { positionMs: Math.floor(e.detail * 1000) })}
                    onWaiting={() => sendEvent('BUFFERING_STARTED')}
                    onPlaying={() => {
                        setHasStartedPlayback(true);
                        sendEvent('BUFFERING_ENDED');
                    }}
                    onTimeUpdate={(e: any) => {
                        const { currentTime, duration } = e.detail;
                        if (currentTime > 0 && !hasStartedPlayback) {
                            setHasStartedPlayback(true);
                        }

                        void maybeSendView(currentTime, duration);

                        const pct = (currentTime / duration) * 100;
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
                        {!hasStartedPlayback && (
                            <Poster
                                className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover opacity-90 transition-opacity data-[hidden]:hidden"
                                src={posterUrl}
                                alt={video.title || 'Video poster'}
                            />
                        )}
                    </MediaProvider>
                    <Captions className="pointer-events-none absolute inset-x-4 bottom-24 z-20 select-none text-center text-base font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.9)] sm:bottom-28 sm:text-lg" />
                    {(playerConfig ? playerConfig.controls : true) && <PolutekVideoControls hasTextTracks={hasTextTracks} />}
                </MediaPlayer>
            )}
        </div>
    );
}
