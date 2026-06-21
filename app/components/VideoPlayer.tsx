"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { MediaPlayer, MediaProvider, Poster, type MediaPlayerInstance } from '@vidstack/react';
import { useAuth } from "@clerk/nextjs";
import { useVideoAccess } from './PremiumWrapper';
import { PublicVideoDTO as VideoType } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { PlayerSkeleton } from '@/components/skeletons';
import { PlayerErrorOverlay } from './PlayerErrorOverlay';
import { PlayerStateFrame } from './PlayerStateFrame';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
}

type CloudflareStreamEventName = 'play' | 'pause' | 'ended' | 'waiting' | 'playing' | 'error' | 'timeupdate';

type CloudflareStreamPlayer = {
    currentTime?: number;
    duration?: number;
    paused?: boolean;
    addEventListener: (event: CloudflareStreamEventName, handler: () => void) => void;
    removeEventListener: (event: CloudflareStreamEventName, handler: () => void) => void;
};

declare global {
    interface Window {
        Stream?: (iframe: HTMLIFrameElement) => CloudflareStreamPlayer;
    }
}

function loadCloudflareStreamSdk(): Promise<(iframe: HTMLIFrameElement) => CloudflareStreamPlayer> {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Cloudflare Stream SDK can only load in the browser'));
    }

    if (window.Stream) return Promise.resolve(window.Stream);

    return new Promise((resolve, reject) => {
        const src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

        const resolveWhenReady = () => {
            if (window.Stream) resolve(window.Stream);
            else reject(new Error('Cloudflare Stream SDK loaded without exposing window.Stream'));
        };

        if (existing) {
            existing.addEventListener('load', resolveWhenReady, { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load Cloudflare Stream SDK')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolveWhenReady;
        script.onerror = () => reject(new Error('Failed to load Cloudflare Stream SDK'));
        document.body.appendChild(script);
    });
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
    const normalizedKind = String(videoSourceKind || '').toLowerCase();
    const isEmbedProvider = normalizedKind === 'youtube' || normalizedKind === 'vimeo' || normalizedKind === 'cloudflare_stream';
    const src = isEmbedProvider ? (videoEmbedUrl || videoUrl) : videoUrl;

    const player = useRef<MediaPlayerInstance>(null);
    const cloudflareIframe = useRef<HTMLIFrameElement>(null);
    const cloudflareIsPlaying = useRef(false);
    const posterUrl = playerConfig?.poster || video.thumbnailUrl || '/logo.png';
    const [isMounted, setIsMounted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const hasReached10s = useRef(false);
    const reachedThresholds = useRef<Record<number, boolean>>({});

    const sendEvent = useCallback(async (type: string, extra: Record<string, unknown> = {}) => {
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

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted || !tracking?.playbackSessionId) return;
        const interval = setInterval(() => {
            if (normalizedKind === 'cloudflare_stream') {
                if (cloudflareIsPlaying.current) {
                    sendEvent('HEARTBEAT', { provider: 'cloudflare_stream', sourceKind: 'cloudflare_stream' });
                }
                return;
            }

            if (player.current?.paused === false) {
                sendEvent('HEARTBEAT');
            }
        }, (tracking.heartbeatIntervalSeconds || 15) * 1000);
        return () => clearInterval(interval);
    }, [isMounted, normalizedKind, tracking, sendEvent]);

    useEffect(() => {
        if (!isMounted || normalizedKind !== 'cloudflare_stream' || !tracking?.playbackSessionId || !src) return;

        let cancelled = false;
        let cleanup: (() => void) | undefined;

        const attachCloudflareTracking = async () => {
            try {
                const createPlayer = await loadCloudflareStreamSdk();
                if (cancelled || !cloudflareIframe.current) return;

                const cloudflarePlayer = createPlayer(cloudflareIframe.current);
                const getTiming = () => {
                    const currentTime = Number(cloudflarePlayer.currentTime || 0);
                    const duration = Number(cloudflarePlayer.duration || 0);
                    return {
                        currentTime,
                        duration,
                        positionMs: Math.floor(currentTime * 1000),
                        durationMs: Number.isFinite(duration) ? Math.floor(duration * 1000) : 0,
                    };
                };

                const sendCloudflareEvent = (type: string, extra: Record<string, unknown> = {}) => {
                    sendEvent(type, {
                        provider: 'cloudflare_stream',
                        sourceKind: 'cloudflare_stream',
                        ...getTiming(),
                        ...extra,
                    });
                };

                const onPlay = () => {
                    cloudflareIsPlaying.current = true;
                    sendCloudflareEvent('PLAY_STARTED');
                };
                const onPause = () => {
                    cloudflareIsPlaying.current = false;
                    sendCloudflareEvent('PLAY_PAUSED');
                };
                const onEnded = () => {
                    cloudflareIsPlaying.current = false;
                    sendCloudflareEvent('ENDED');
                };
                const onWaiting = () => sendCloudflareEvent('BUFFERING_STARTED');
                const onPlaying = () => {
                    cloudflareIsPlaying.current = true;
                    sendCloudflareEvent('BUFFERING_ENDED');
                };
                const onError = () => sendCloudflareEvent('PLAYER_ERROR', { errorCode: 'LOAD_FAILED' });
                const onTimeUpdate = () => {
                    const timing = getTiming();

                    if (!hasReached10s.current && timing.currentTime >= 10) {
                        hasReached10s.current = true;
                        sendCloudflareEvent('WATCHED_10_SECONDS', timing);
                    }

                    if (!timing.duration || timing.duration <= 0) return;

                    const pct = (timing.currentTime / timing.duration) * 100;
                    const thresholds = [
                        { pct: 25, type: 'WATCHED_25_PERCENT' },
                        { pct: 50, type: 'WATCHED_50_PERCENT' },
                        { pct: 75, type: 'WATCHED_75_PERCENT' },
                        { pct: 90, type: 'WATCHED_90_PERCENT' },
                    ];

                    for (const threshold of thresholds) {
                        if (pct >= threshold.pct && !reachedThresholds.current[threshold.pct]) {
                            reachedThresholds.current[threshold.pct] = true;
                            sendCloudflareEvent(threshold.type, timing);
                        }
                    }
                };

                const listeners: Array<[CloudflareStreamEventName, () => void]> = [
                    ['play', onPlay],
                    ['pause', onPause],
                    ['ended', onEnded],
                    ['waiting', onWaiting],
                    ['playing', onPlaying],
                    ['error', onError],
                    ['timeupdate', onTimeUpdate],
                ];

                listeners.forEach(([event, handler]) => cloudflarePlayer.addEventListener(event, handler));
                cleanup = () => listeners.forEach(([event, handler]) => cloudflarePlayer.removeEventListener(event, handler));
            } catch (error) {
                console.warn('Failed to initialize Cloudflare Stream tracking', error);
            }
        };

        attachCloudflareTracking();

        return () => {
            cancelled = true;
            cloudflareIsPlaying.current = false;
            cleanup?.();
        };
    }, [isMounted, normalizedKind, src, tracking?.playbackSessionId, sendEvent]);

    // Hydration guard
    if (!isMounted || isLoading) {
        return (
            <PlayerStateFrame>
                <PlayerSkeleton />
            </PlayerStateFrame>
        );
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

    const isSupported = isEmbedProvider || ['hls', 'dash', 'mp4', 'direct', 'vercel_blob', 'blob'].includes(normalizedKind);

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

    if (normalizedKind === 'cloudflare_stream') {
        return (
            <div className="relative w-full h-full min-h-0 sm:min-h-[220px] bg-black rounded-xl overflow-hidden shadow-2xl group">
                {loadError ? (
                    <PlayerErrorOverlay
                        errorCode="MEDIA_LOAD_FAILED"
                        onRetry={() => {
                            setLoadError(null);
                            refreshPlaybackPlan?.();
                        }}
                        isAdmin={isAdmin}
                    />
                ) : (
                    <iframe
                        ref={cloudflareIframe}
                        key={playerKey}
                        className="h-full w-full border-0"
                        src={src}
                        title={playerConfig?.title || video.title || 'Video'}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        onLoad={() => sendEvent('PLAYER_READY', { provider: 'cloudflare_stream', sourceKind: 'cloudflare_stream' })}
                        onError={() => {
                            setLoadError('Nie udało się załadować materiału wideo. Sprawdź dostępność źródła.');
                            setPlayerKey((k) => k + 1);
                            sendEvent('PLAYER_ERROR', { errorCode: 'LOAD_FAILED', provider: 'cloudflare_stream', sourceKind: 'cloudflare_stream' });
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="relative w-full h-full min-h-0 sm:min-h-[220px] bg-black rounded-xl overflow-hidden shadow-2xl group">
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
                    controls={playerConfig ? playerConfig.controls : true}
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
                </MediaPlayer>
            )}
        </div>
    );
}