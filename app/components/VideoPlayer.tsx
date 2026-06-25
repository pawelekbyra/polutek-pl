"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
    CaptionButton,
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
    useMediaState,
    type MediaPlayerInstance,
} from '@vidstack/react';
import { useAuth } from "@clerk/nextjs";
import { useVideoAccess } from './PremiumWrapper';
import { PublicVideoDTO as VideoType } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { PlayerErrorOverlay } from './PlayerErrorOverlay';
import { PlayerStateFrame } from './PlayerStateFrame';
import { PlayerLoadingState } from './PlayerLoadingState';
import { resolveCloudflarePlaybackSource } from './cloudflarePlaybackSource';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
}


const doodleIconClass = "h-5 w-5 drop-shadow-[1.5px_1.5px_0_rgba(14,165,233,0.45)]";

function PolutekWatermark() {
    return (
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex h-11 w-11 rotate-3 items-center justify-center rounded-[1.15rem] border-2 border-sky-300/80 bg-white/88 text-2xl font-black italic text-sky-600 shadow-[3px_4px_0_rgba(14,165,233,0.28)] ring-1 ring-white/60 backdrop-blur-sm sm:right-5 sm:top-5">
            <span className="-translate-y-0.5 font-serif drop-shadow-[1px_1px_0_rgba(255,255,255,0.95)]">P</span>
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-300 shadow-sm" />
        </div>
    );
}

function DoodlePlayIcon() {
    return (
        <svg viewBox="0 0 24 24" className={doodleIconClass} aria-hidden="true">
            <path d="M8.2 5.4c-.9.5-1.1 11.8-.1 12.7.8.8 10.1-4.7 10.3-6 .2-1.3-9.2-7.3-10.2-6.7Z" fill="currentColor" stroke="white" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
    );
}

function DoodlePauseIcon() {
    return (
        <svg viewBox="0 0 24 24" className={doodleIconClass} aria-hidden="true">
            <path d="M8 5.2c-1.2.1-1.4.8-1.4 6.9 0 5.8.3 6.7 1.5 6.8l2.2.1c1.1-.1 1.4-.9 1.4-6.9 0-6.2-.4-6.9-1.5-7L8 5.2Zm7.1-.1c-1.1.1-1.4.9-1.4 7 0 5.9.3 6.7 1.5 6.8l2 .1c1.2-.1 1.5-.9 1.5-6.9 0-6.1-.3-6.8-1.4-7l-2.2 0Z" fill="currentColor" stroke="white" strokeWidth="1.35" strokeLinejoin="round" />
        </svg>
    );
}

function DoodleVolumeIcon() {
    return (
        <svg viewBox="0 0 24 24" className={doodleIconClass} aria-hidden="true">
            <path d="M4.2 9.1h3.2l4.1-3.2c.8-.6 1.9-.1 1.9.9v10.4c0 1-1.1 1.5-1.9.9l-4.1-3.2H4.2c-.8 0-1.4-.6-1.4-1.4v-3c0-.8.6-1.4 1.4-1.4Z" fill="currentColor" stroke="white" strokeWidth="1.35" strokeLinejoin="round" />
            <path d="M16.1 8.3c1.7 1.8 1.8 5.3 0 7.3M18.7 6.1c3.1 3.1 3.2 8.4.1 11.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function DoodleCaptionsIcon() {
    return (
        <svg viewBox="0 0 24 24" className={doodleIconClass} aria-hidden="true">
            <path d="M4.2 6.2c1.4-1 14.3-.9 15.5.1 1.2.9 1.1 10.4-.1 11.3-1.5 1-13.9 1.2-15.3.1-1.2-1-1.4-10.5-.1-11.5Z" fill="currentColor" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7.1 11.1h3.4M13.5 11.1h3.4M7.1 14.6h5.2M15 14.6h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function DoodleFullscreenIcon() {
    return (
        <svg viewBox="0 0 24 24" className={doodleIconClass} aria-hidden="true">
            <path d="M5.4 9V5.4H9M15 5.4h3.6V9M18.6 15v3.6H15M9 18.6H5.4V15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 6l4 4M18 6l-4 4M18 18l-4-4M6 18l4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function DoodlePlayButton({ className }: { className: string }) {
    const paused = useMediaState('paused');

    return (
        <PlayButton className={className} aria-label="Odtwórz / pauza">
            {paused ? <DoodlePlayIcon /> : <DoodlePauseIcon />}
        </PlayButton>
    );
}

function DoodlePlayerControls() {
    const buttonClass = "grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-sky-500 hover:shadow-[2px_3px_0_rgba(255,255,255,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200";

    return (
        <Controls.Root className="absolute inset-0 z-30 flex flex-col justify-end bg-gradient-to-t from-black/82 via-black/24 to-black/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[visible]:opacity-100">
            <div className="px-2 pb-1 sm:px-4 sm:pb-2">
                <TimeSlider.Root className="group/slider relative mb-1 flex h-7 w-full cursor-pointer touch-none select-none items-center" aria-label="Postęp filmu">
                    <TimeSlider.Track className="relative h-2 w-full overflow-hidden rounded-full border border-white/20 bg-white/25 shadow-[0_2px_0_rgba(255,255,255,0.14)] transition-all group-hover/slider:h-3">
                        <TimeSlider.Progress className="absolute h-full bg-white/35" />
                        <TimeSlider.TrackFill className="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-amber-300" />
                    </TimeSlider.Track>
                    <TimeSlider.Thumb className="absolute left-[var(--slider-fill)] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-400 opacity-0 shadow-[2px_2px_0_rgba(255,255,255,0.35)] transition group-hover/slider:opacity-100" />
                </TimeSlider.Root>
                <Controls.Group className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <DoodlePlayButton className={buttonClass} />
                        <MuteButton className={buttonClass} aria-label="Wycisz / włącz dźwięk"><DoodleVolumeIcon /></MuteButton>
                        <VolumeSlider.Root className="group/volume hidden h-10 w-24 items-center md:flex" aria-label="Głośność">
                            <VolumeSlider.Track className="relative h-2 w-full rounded-full bg-white/25">
                                <VolumeSlider.TrackFill className="absolute h-full rounded-full bg-sky-300" />
                            </VolumeSlider.Track>
                            <VolumeSlider.Thumb className="absolute left-[var(--slider-fill)] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-amber-300" />
                        </VolumeSlider.Root>
                        <CaptionButton className={buttonClass} aria-label="Napisy"><DoodleCaptionsIcon /></CaptionButton>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                        <div className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-bold tabular-nums tracking-wide text-white shadow-[2px_2px_0_rgba(14,165,233,0.26)] sm:text-xs">
                            <Time type="current" /> <span className="text-white/55">/</span> <Time type="duration" />
                        </div>
                        <FullscreenButton className={buttonClass} aria-label="Pełny ekran"><DoodleFullscreenIcon /></FullscreenButton>
                    </div>
                </Controls.Group>
            </div>
        </Controls.Root>
    );
}

export default function VideoPlayer({ video, variant = 'hero' }: VideoPlayerProps) {
    const { playbackPlan, refreshPlaybackPlan, isLoading } = useVideoAccess();
    const { orgRole } = useAuth();
    const isAdmin = orgRole === 'admin' || orgRole === 'org:admin';
    const [playerKey, setPlayerKey] = useState(0);
    const { source, tracking, player: playerConfig } = playbackPlan || {};
    const videoUrl = source?.playbackUrl;
    const videoSourceKind = source?.kind;
    const videoEmbedUrl = source?.embedUrl;

    const player = useRef<MediaPlayerInstance>(null);
    const posterUrl = playerConfig?.poster || video.thumbnailUrl || '/logo.png';
    const [isMounted, setIsMounted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const hasReached10s = useRef(false);
    const cloudflareViewFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reachedThresholds = useRef<Record<number, boolean>>({});

    const sendEvent = useCallback(async (type: string, extra = {}) => {
        if (!tracking?.playbackSessionId) return;
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
            }
        } catch (e) {
            console.warn("Failed to send playback event", type, e);
        }
    }, [video.id, tracking?.playbackSessionId, refreshPlaybackPlan]);

    const clearCloudflareViewFallback = useCallback(() => {
        if (cloudflareViewFallbackTimer.current) {
            clearTimeout(cloudflareViewFallbackTimer.current);
            cloudflareViewFallbackTimer.current = null;
        }
    }, []);

    const sendWatched10Seconds = useCallback(() => {
        if (hasReached10s.current) return;
        hasReached10s.current = true;
        sendEvent('WATCHED_10_SECONDS', { positionMs: 10000 });
    }, [sendEvent]);

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
        if (!isMounted || !tracking?.playbackSessionId) return;
        const interval = setInterval(() => {
            if (player.current?.paused === false) {
                sendEvent('HEARTBEAT');
            }
        }, (tracking.heartbeatIntervalSeconds || 15) * 1000);
        return () => clearInterval(interval);
    }, [isMounted, tracking, sendEvent]);

    // Hydration guard
    if (!isMounted || isLoading) {
        return <PlayerLoadingState variant={variant === 'hero' ? 'default' : 'thumbnail'} />;
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

    const normalizedKind = String(videoSourceKind || '').toLowerCase();
    const cloudflarePlaybackSource = normalizedKind === 'cloudflare_stream'
        ? resolveCloudflarePlaybackSource({ playbackUrl: videoUrl, embedUrl: videoEmbedUrl })
        : null;
    const isCloudflareIframeFallback = cloudflarePlaybackSource?.mode === 'iframe';
    const isCloudflareHlsSource = cloudflarePlaybackSource?.mode === 'hls';
    const isEmbedProvider = normalizedKind === 'youtube' || normalizedKind === 'vimeo' || isCloudflareIframeFallback;
    const src = cloudflarePlaybackSource?.src || (isEmbedProvider ? (videoEmbedUrl || videoUrl) : videoUrl);

    if (!src) {
        return (
            <PlayerStateFrame>
                <PlayerErrorOverlay
                    errorCode="NO_PLAYBACK_URL"
                    onRetry={() => refreshPlaybackPlan()}
                    isAdmin={isAdmin}
                />
            </PlayerStateFrame>
        );
    }

    const isSupported = isEmbedProvider || isCloudflareHlsSource || ['hls', 'dash', 'mp4', 'direct', 'vercel_blob', 'blob'].includes(normalizedKind);

    if (!isSupported) {
        return (
            <PlayerStateFrame>
                <PlayerErrorOverlay
                    errorCode="UNSUPPORTED_SOURCE"
                    onRetry={() => refreshPlaybackPlan()}
                    isAdmin={isAdmin}
                />
            </PlayerStateFrame>
        );
    }

    if (isCloudflareIframeFallback) {
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
                    onPlay={() => sendEvent('PLAY_STARTED')}
                    onPause={() => sendEvent('PLAY_PAUSED')}
                    onEnded={() => sendEvent('ENDED')}
                    onSeeked={(e: any) => sendEvent('SEEKED', { positionMs: Math.floor(e.detail * 1000) })}
                    onWaiting={() => sendEvent('BUFFERING_STARTED')}
                    onPlaying={() => sendEvent('BUFFERING_ENDED')}
                    onTimeUpdate={(e: any) => {
                        const { currentTime, duration } = e.detail;
                        if (!hasReached10s.current && currentTime >= 10) {
                            hasReached10s.current = true;
                            sendEvent('WATCHED_10_SECONDS');
                        }

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
                        <Poster
                            className="absolute inset-0 block h-full w-full object-cover opacity-90"
                            src={posterUrl}
                            alt={video.title || 'Video poster'}
                        />
                    </MediaProvider>
                    {(playerConfig ? playerConfig.controls : true) && <DoodlePlayerControls />}
                </MediaPlayer>
            )}
        </div>
    );
}
