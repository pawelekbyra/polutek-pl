"use client";

import React, { useState, useEffect } from 'react';
import { useVideoAccess } from './PremiumWrapper';
import { Video as VideoType } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { Play, AlertCircle } from './icons';

// Vidstack Imports
import { MediaPlayer, MediaProvider, Poster } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';

// Vidstack Styles
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
}

export default function VideoPlayer({ video, variant = 'hero' }: VideoPlayerProps) {
    const { videoUrl } = useVideoAccess();
    const [isMounted, setIsMounted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        // Small timeout to ensure the DOM and context are ready
        const timer = setTimeout(() => {
            setIsMounted(true);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

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
                    src={video.thumbnailUrl}
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
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-16 h-16 md:w-24 md:h-24 bg-black/80 backdrop-blur-sm rounded-md flex items-center justify-center border border-white/10">
                    <Play className="text-white w-8 h-8 md:w-12 md:h-12 ml-1" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group shadow-2xl vidstack-player-container">
            {loadError ? (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-white font-bold text-lg mb-2">Błąd ładowania filmu</h3>
                    <p className="text-neutral-400 text-sm max-w-md">{loadError}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-white text-black rounded-md font-bold text-sm hover:bg-neutral-200 transition-colors"
                    >
                        Odśwież stronę
                    </button>
                </div>
            ) : (
                <MediaPlayer
                    title={video.title}
                    src={videoUrl}
                    poster={video.thumbnailUrl}
                    load="visible"
                    autoPlay={variant === 'hero'}
                    muted={variant === 'hero'}
                    playsInline
                    key={videoUrl} // Force re-mount on URL change to prevent state carryover
                    onCanPlay={() => {
                        console.log('[Vidstack] Video is ready to play');
                        setLoadError(null);
                    }}
                    onError={(detail) => {
                        console.error('[Vidstack] Load Error:', detail);
                        setLoadError('Nie udało się załadować materiału wideo. Sprawdź połączenie internetowe lub spróbuj ponownie później.');
                    }}
                    className="w-full h-full"
                    controlsDelay={100}
                >
                    <MediaProvider>
                        <Poster
                            className="vds-poster"
                            src={video.thumbnailUrl}
                            alt={video.title}
                        />
                    </MediaProvider>
                    <DefaultVideoLayout
                        icons={defaultLayoutIcons}
                        noModal
                    />
                </MediaPlayer>
            )}

            <style jsx global>{`
                /* Brand Theme Overrides - Scoped to container and matching site's #3b82f6 blue */
                .vidstack-player-container {
                    --video-brand: #3b82f6;
                    --video-focus: #3b82f6;
                }

                .vidstack-player-container .vds-player {
                    background-color: #000;
                    border-radius: 8px;
                }

                /* Custom progress bar - matching site's blue and repositioned lower */
                .vidstack-player-container .vds-slider[data-type="progress"] {
                    --slider-track-height: 2px;
                    --slider-thumb-size: 12px;
                    --slider-active-track-bg: #3b82f6;
                    --slider-thumb-bg: #3b82f6;
                    margin-bottom: -4px !important;
                    z-index: 20;
                    width: 100% !important;
                }

                .vidstack-player-container .vds-slider[data-type="progress"]:hover {
                    --slider-track-height: 4px;
                }

                /* Tighten the layout of control groups to match YouTube's proportions */
                .vidstack-player-container .vds-controls {
                    padding-bottom: 8px !important;
                }

                .vidstack-player-container .vds-controls-group {
                    padding: 0 16px !important;
                }

                /* Specifically target the progress bar container group */
                .vidstack-player-container .vds-controls-group:has(.vds-slider[data-type="progress"]) {
                    padding: 0 !important;
                    margin-bottom: -2px !important;
                }

                /* Mobile responsiveness */
                @media (max-width: 640px) {
                    .vidstack-player-container,
                    .vidstack-player-container .vds-player {
                        border-radius: 0;
                    }
                }

                /* Ensure controls are styled professionally with smooth animations */
                .vidstack-player-container .vds-controls {
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
                    transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
                    visibility: visible;
                }

                /* Smooth slide-down animation when controls hide */
                .vidstack-player-container .vds-player:not([data-controls-visible]) .vds-controls {
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(8px);
                    pointer-events: none;
                }

                .vidstack-player-container .vds-player[data-controls-visible] .vds-controls {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                    pointer-events: auto;
                }
            `}</style>
        </div>
    );
}
