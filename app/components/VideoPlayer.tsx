"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { MediaPlayer, MediaProvider, Poster, type MediaPlayerInstance } from '@vidstack/react';
import { useVideoAccess } from './PremiumWrapper';
import { PublicVideoDTO as VideoType } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { Play, AlertCircle } from './icons';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
}

export default function VideoPlayer({ video, variant = 'hero' }: VideoPlayerProps) {
    const { videoUrl, videoSourceKind, videoEmbedUrl, tracking } = useVideoAccess() as any;
    const player = useRef<MediaPlayerInstance>(null);
    const posterUrl = video.thumbnailUrl || '/logo.png';
    const [isMounted, setIsMounted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const hasReached10s = useRef(false);

    const sendEvent = useCallback(async (type: string, extra = {}) => {
        if (!tracking?.playbackSessionId) return;
        try {
            await fetch(`/api/videos/${video.id}/playback-event`, {
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
        } catch (e) {
            console.warn("Failed to send playback event", type, e);
        }
    }, [video.id, tracking?.playbackSessionId]);

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

    // Optimized Thumbnail Variant: No player engine, just a static preview
    if (variant === 'thumbnail' || !videoUrl) {
        return (
            <div
                className={cn(
                    "relative w-full h-full group/player overflow-hidden bg-neutral-900",
                    variant === 'hero' ? "cursor-pointer" : "cursor-default"
                )}
            >
                {variant === 'hero' && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 opacity-0 group-hover/player:opacity-100 transition-opacity duration-500" />
                )}

                <Image
                    src={posterUrl}
                    alt={video.title || 'Video poster'}
                    fill
                    className="w-full h-full object-cover opacity-90 transition duration-700 group-hover/player:scale-105"
                />
                {variant === 'hero' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className={cn(
                            "bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10 transition-all duration-500",
                            "w-16 h-16 md:w-24 md:h-24 shadow-2xl group-hover/player:scale-110 group-hover/player:bg-black/90"
                        )}>
                            <Play className="text-white w-8 h-8 md:w-12 md:h-12 ml-1" />
                        </div>
                    </div>
                )}
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

    // Hydration guard
    if (!isMounted) return (
        <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center cursor-pointer rounded-lg">
            <Image
                src={posterUrl}
                alt={video.title || 'Video poster'}
                fill
                className="w-full h-full object-cover opacity-60"
            />
            {variant === 'hero' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                        <Play className="text-white w-8 h-8 ml-1" />
                    </div>
                </div>
            )}
        </div>
    );

    const isEmbedProvider = videoSourceKind === 'youtube' || videoSourceKind === 'vimeo';
    const src = isEmbedProvider ? (videoEmbedUrl || videoUrl) : videoUrl;

    return (
        <div className="relative w-full h-full min-h-0 sm:min-h-[220px] bg-black rounded-xl overflow-hidden shadow-2xl group">
            {loadError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-white p-6 text-center">
                    <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                    <p className="font-medium">{loadError}</p>
                    <p className="text-xs text-white/60 mt-2">Źródło: {videoSourceKind || 'URL wideo'}</p>
                </div>
            ) : (
                <MediaPlayer
                    ref={player}
                    className="h-full w-full bg-black text-white [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_iframe]:h-full [&_iframe]:w-full"
                    title={video.title || 'Video'}
                    src={src}
                    poster={posterUrl}
                    muted={variant === 'hero'}
                    autoPlay={variant === 'hero'}
                    playsInline
                    controls
                    aspectRatio="16/9"
                    onPlay={() => sendEvent('PLAY_STARTED')}
                    onPause={() => sendEvent('PLAY_PAUSED')}
                    onTimeUpdate={(e) => {
                        if (!hasReached10s.current && e.currentTime >= 10) {
                            hasReached10s.current = true;
                            sendEvent('WATCHED_10_SECONDS');
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
