"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useVideoAccess } from './PremiumWrapper';
import { Video as VideoType } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { Play, AlertCircle } from './icons';
import Artplayer from 'artplayer';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
}

export default function VideoPlayer({ video, variant = 'hero' }: VideoPlayerProps) {
    const { videoUrl } = useVideoAccess();
    const posterUrl = video.thumbnailUrl || '/logo.png';
    const [isMounted, setIsMounted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const artRef = useRef<HTMLDivElement>(null);
    const playerInstance = useRef<Artplayer | null>(null);

    useEffect(() => {
        setIsMounted(true);
        return () => {
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
            }
        };
    }, []);

    useEffect(() => {
        if (isMounted && artRef.current && videoUrl && variant !== 'thumbnail') {
            // Clean up previous instance
            if (playerInstance.current) {
                playerInstance.current.destroy(false);
            }

            playerInstance.current = new Artplayer({
                container: artRef.current,
                url: videoUrl,
                poster: posterUrl,
                volume: 0.7,
                muted: variant === 'hero',
                autoplay: variant === 'hero',
                pip: true,
                autoSize: false,
                screenshot: false,
                setting: true,
                loop: false,
                playbackRate: true,
                aspectRatio: false,
                fullscreen: true,
                fullscreenWeb: false,
                mutex: true,
                playsInline: true,
                theme: '#2563eb',
                lang: 'pl',
                moreVideoAttr: {
                    style: {
                        objectFit: 'cover',
                    } as any,
                },
            });

            playerInstance.current.on('error', (error) => {
                console.error('[Artplayer] Error:', error);
                setLoadError('Nie udało się załadować materiału wideo. Sprawdź połączenie internetowe lub spróbuj ponownie później.');
            });

            return () => {
                if (playerInstance.current) {
                    playerInstance.current.destroy(false);
                }
            };
        }
    }, [isMounted, videoUrl, variant, video.thumbnailUrl, video.title, loadError]);

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

                <img
                    src={posterUrl}
                    alt={video.title}
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
            <img
                src={posterUrl}
                alt={video.title}
                className="w-full h-full object-cover opacity-60"
            />
            {variant === 'hero' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-black/80 backdrop-blur-sm rounded-md flex items-center justify-center border border-white/10">
                        <Play className="text-white w-8 h-8 md:w-12 md:h-12 ml-1" />
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group shadow-2xl artplayer-container">
            {loadError ? (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-white font-bold text-lg mb-2">Błąd ładowania filmu</h3>
                    <p className="text-neutral-400 text-sm max-w-md">{loadError}</p>
                    <button
                        onClick={() => setLoadError(null)}
                        className="mt-6 px-6 py-2 bg-white text-black rounded-md font-bold text-sm hover:bg-neutral-200 transition-colors"
                    >
                        Spróbuj ponownie
                    </button>
                </div>
            ) : (
                <div ref={artRef} className="w-full h-full" />
            )}

            <style jsx global>{`
                .artplayer-container .art-video-player video,
                .artplayer-container .art-poster {
                    object-fit: cover !important;
                }

                .artplayer-container .artplayer-app {
                    border-radius: 8px;
                    overflow: hidden;
                    width: 100% !important;
                    height: 100% !important;
                }

                /* YouTube-like Progress Bar for Artplayer */
                .artplayer-container .art-control-progress {
                    height: 12px !important;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 0 !important;
                    margin-bottom: -1px !important;
                }

                .artplayer-container .art-control-progress-inner {
                    height: 3px !important;
                    transition: height 0.2s ease-in-out !important;
                }

                .artplayer-container .art-control-progress:hover .art-control-progress-inner {
                    height: 8px !important;
                }

                .artplayer-container .art-progress-indicator {
                    width: 14px !important;
                    height: 14px !important;
                    background: #2563eb !important;
                    border: none !important;
                    opacity: 0 !important;
                    transition: opacity 0.2s ease-in-out !important;
                    margin-top: 0 !important;
                    transform: translateY(0) !important;
                    z-index: 10 !important;
                }

                .artplayer-container .art-control-progress:hover .art-progress-indicator {
                    opacity: 1 !important;
                }

                .artplayer-container .art-progress-played {
                    background: #2563eb !important;
                }

                .artplayer-container .art-progress-highlight {
                    background: rgba(255, 255, 255, 0.3) !important;
                }

                .artplayer-container .art-progress-loaded {
                    background: rgba(255, 255, 255, 0.2) !important;
                }

                /* Mobile responsiveness */
                @media (max-width: 640px) {
                    .artplayer-container .art-video-player {
                        border-radius: 0;
                    }
                }
            `}</style>
        </div>
    );
}
