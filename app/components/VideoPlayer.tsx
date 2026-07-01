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
    VolumeSlider,
    useMediaRemote,
    isTrackCaptionKind,
    useMediaState,
    type MediaPlayerInstance,
} from '@vidstack/react';
import { useAuth } from "@clerk/nextjs";
import { useVideoAccess } from './PremiumWrapper';
import { PublicVideoDTO as VideoType, type VideoTextTrackDTO } from '@/app/types/video';
import { cn } from '@/lib/utils';
import { NajsIcon, INK } from './najs/primitives';
import { PlayerErrorOverlay } from './PlayerErrorOverlay';
import { PlayerStateFrame } from './PlayerStateFrame';
import { resolvePlaybackSource } from './playback-source';
import { shouldSendViewForPlaybackPosition } from './video-view-threshold';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
    onViewCounted?: () => void;
}

const playerIconClass = "h-[1.5rem] w-[1.5rem]";
const centerPauseIconClass = "h-14 w-14 drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)]";
const sliderAccentClass = "bg-white/85";

function PolutekWatermark() {
    return (
        <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
            <div className="relative flex h-9 w-9 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 36 36" aria-hidden="true">
                    <path d={`M 5 7 C 4 5 5 4 7 4 L 29 4 C 31 4 32 5 32 7 L 32 29 C 32 31 31 32 29 32 L 7 32 C 5 32 4 31 4 29 Z`}
                        fill="rgba(248,243,231,0.88)" stroke={INK} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="relative text-[17px] font-bold text-[#171717]" style={{ fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}>P</span>
            </div>
        </div>
    );
}

function getPlayerEvent(event: React.SyntheticEvent | PointerEvent | KeyboardEvent) {
    return 'nativeEvent' in event ? event.nativeEvent : event;
}

function useTogglePlayback() {
    const remote = useMediaRemote();
    const paused = useMediaState('paused');
    const ended = useMediaState('ended');
    const currentTime = useMediaState('currentTime');
    const duration = useMediaState('duration');

    return useCallback((event: React.SyntheticEvent | PointerEvent | KeyboardEvent) => {
        const playerEvent = getPlayerEvent(event);

        if (paused) {
            const shouldResumeFromSeekedEndedState = ended
                && Number.isFinite(currentTime)
                && Number.isFinite(duration)
                && duration > 0
                && currentTime < duration - 0.25;

            if (shouldResumeFromSeekedEndedState) {
                remote.seek(currentTime, playerEvent);
                requestAnimationFrame(() => remote.play(playerEvent));
                return;
            }

            remote.play(playerEvent);
            return;
        }

        remote.pause(playerEvent);
    }, [currentTime, duration, ended, paused, remote]);
}

function PlayerPlayButton({ className }: { className: string }) {
    const paused = useMediaState('paused');
    const togglePlayback = useTogglePlayback();

    return (
        <button
            type="button"
            className={className}
            aria-label={paused ? "Odtwórz" : "Pauza"}
            onClick={(event) => {
                event.stopPropagation();
                togglePlayback(event);
            }}
        >
            {paused ? <NajsIcon name="play" className={playerIconClass} stroke="currentColor" /> : <NajsIcon name="pause" className={playerIconClass} stroke="currentColor" />}
        </button>
    );
}

function PlayerTapTarget() {
    const paused = useMediaState('paused');
    const togglePlayback = useTogglePlayback();

    return (
        <button
            type="button"
            className={cn(
                "absolute inset-0 z-10 grid place-items-center text-white transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/85",
                paused ? "opacity-100" : "opacity-0"
            )}
            aria-label={paused ? "Odtwórz film" : "Pauza"}
            onClick={(event) => {
                event.stopPropagation();
                togglePlayback(event);
            }}
        >
            {paused ? <NajsIcon name="play" className={centerPauseIconClass} stroke="currentColor" /> : null}
        </button>
    );
}

function PlayerMuteIcon() {
    const muted = useMediaState('muted');
    const volume = useMediaState('volume');
    const iconName = muted || volume === 0 ? "mute" : "volume";

    return <NajsIcon name={iconName} className={playerIconClass} stroke="currentColor" />;
}

function PlayerCaptionButton({ className, disabled = false }: { className: string; disabled?: boolean }) {
    const textTrack = useMediaState('textTrack');
    const captionsOn = Boolean(textTrack && isTrackCaptionKind(textTrack));

    return (
        <CaptionButton
            className={cn(className, captionsOn && "bg-[#1F7A88] text-white hover:bg-[#1F7A88]/90 active:bg-[#1F7A88]/85")}
            aria-label={captionsOn ? "Wyłącz napisy" : "Włącz napisy"}
            aria-pressed={captionsOn}
            disabled={disabled}
            title={disabled ? "Brak napisów dla tego filmu" : undefined}
        >
            <NajsIcon name="subtitles" className={playerIconClass} stroke="currentColor" />
        </CaptionButton>
    );
}

function formatPlayerTime(value: number | null | undefined) {
    if (!Number.isFinite(value) || !value || value < 0) return '0:00';

    const totalSeconds = Math.floor(value);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function PlayerTimeReadout() {
    const currentTime = useMediaState('currentTime');
    const duration = useMediaState('duration');

    return (
        <span className="inline-flex min-w-[5.75rem] shrink-0 items-center gap-1 whitespace-nowrap text-left text-[12px] font-semibold leading-none tabular-nums text-white/90 sm:min-w-[8.5rem] sm:text-[15px]">
            <span>{formatPlayerTime(currentTime)}</span><span className="text-white/60">/</span><span className="text-white/75">{formatPlayerTime(duration)}</span>
        </span>
    );
}

function PolutekVideoControls({ hasTextTracks }: { hasTextTracks: boolean }) {
    const buttonClass = "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/12 hover:text-white active:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11";
    const trackClass = "relative h-[3px] w-full overflow-hidden rounded-full bg-white/22 transition-[height] group-data-[dragging]/slider:h-[4px]";
    const thumbClass = "pointer-events-auto absolute left-[var(--slider-fill)] top-1/2 z-10 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-[1.5px] border-[#171717]/70 shadow-[1px_2px_0_rgba(0,0,0,0.35)] transition-transform group-data-[dragging]/slider:scale-125";

    return (
        <Controls.Root className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pb-1.5 pt-5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[visible]:opacity-100 sm:px-4 sm:pb-3 sm:pt-10">
            <PlayerTimeScrubber trackClass={trackClass} thumbClass={thumbClass} />

            <Controls.Group className="mt-0 flex min-h-9 min-w-0 items-center justify-between gap-2 sm:min-h-11 sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                    <PlayerPlayButton className={buttonClass} />

                    <div className="flex shrink-0 items-center gap-1">
                        <MuteButton className={buttonClass} aria-label="Wycisz / włącz dźwięk"><PlayerMuteIcon /></MuteButton>
                        <VolumeSlider.Root className="group/slider relative hidden h-11 w-28 shrink-0 cursor-pointer touch-none select-none items-center py-3 md:flex" aria-label="Głośność">
                            <VolumeSlider.Track className={trackClass}>
                                <VolumeSlider.TrackFill className={`pointer-events-none absolute h-full rounded-full ${sliderAccentClass}`} />
                            </VolumeSlider.Track>
                            <VolumeSlider.Thumb className={thumbClass} />
                        </VolumeSlider.Root>
                    </div>

                    <PlayerTimeReadout />
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                    <PlayerCaptionButton className={buttonClass} disabled={!hasTextTracks} />
                    <FullscreenButton className={buttonClass} aria-label="Pełny ekran"><NajsIcon name="maximize" className={playerIconClass} stroke="currentColor" /></FullscreenButton>
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

function PlayerTimeScrubber({ trackClass, thumbClass }: { trackClass: string; thumbClass: string }) {
    const remote = useMediaRemote();
    const currentTime = useMediaState('currentTime');
    const duration = useMediaState('duration');
    const [isDragging, setIsDragging] = useState(false);
    const [dragTime, setDragTime] = useState(0);
    const [optimisticSeekTime, setOptimisticSeekTime] = useState<number | null>(null);
    const scrubberRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const displayTime = isDragging ? dragTime : optimisticSeekTime ?? currentTime;
    const safeTime = safeDuration ? Math.min(Math.max(displayTime || 0, 0), safeDuration) : 0;
    const fillPercent = safeDuration ? (safeTime / safeDuration) * 100 : 0;

    useEffect(() => {
        if (optimisticSeekTime === null || isDragging) return;

        const resolvedTime = Number.isFinite(currentTime) ? currentTime : 0;
        if (Math.abs(resolvedTime - optimisticSeekTime) < 0.35) {
            setOptimisticSeekTime(null);
        }
    }, [currentTime, optimisticSeekTime, isDragging]);

    const setDraggingState = useCallback((nextValue: boolean) => {
        isDraggingRef.current = nextValue;
        setIsDragging(nextValue);
    }, []);

    const getTimeFromPointer = useCallback((clientX: number) => {
        const rect = scrubberRef.current?.getBoundingClientRect();
        if (!rect || !safeDuration) return null;

        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        return ratio * safeDuration;
    }, [safeDuration]);

    const seekToPointerTime = useCallback((nextTime: number, event: React.SyntheticEvent | PointerEvent | KeyboardEvent, keepDragging: boolean, playAfterSeek = false) => {
        if (!safeDuration || !Number.isFinite(nextTime)) {
            setDraggingState(false);
            return;
        }

        const playerEvent = getPlayerEvent(event);
        const clampedTime = Math.min(Math.max(nextTime, 0), safeDuration);
        setDragTime(clampedTime);
        setOptimisticSeekTime(clampedTime);
        setDraggingState(keepDragging);
        remote.seek(clampedTime, playerEvent);

        if (playAfterSeek) {
            requestAnimationFrame(() => remote.play(playerEvent));
        }
    }, [remote, safeDuration, setDraggingState]);

    return (
        <div
            ref={scrubberRef}
            className="group/slider relative z-40 mt-1 flex h-7 w-full cursor-pointer touch-none select-none items-center py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/85 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60 sm:mt-2 sm:h-12 sm:py-3"
            style={{ "--slider-fill": `${fillPercent}%` } as React.CSSProperties}
            data-dragging={isDragging ? "" : undefined}
            data-disabled={!safeDuration}
            role="slider"
            tabIndex={safeDuration ? 0 : -1}
            aria-label="Postęp filmu"
            aria-valuemin={0}
            aria-valuemax={safeDuration || 0}
            aria-valuenow={safeTime}
            aria-disabled={!safeDuration}
            onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const nextTime = getTimeFromPointer(event.clientX);
                if (nextTime === null) return;

                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                seekToPointerTime(nextTime, event, true);
            }}
            onPointerMove={(event) => {
                if (!isDraggingRef.current) return;

                event.preventDefault();
                event.stopPropagation();
                const nextTime = getTimeFromPointer(event.clientX);
                if (nextTime === null) return;
                seekToPointerTime(nextTime, event, true);
            }}
            onPointerUp={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!isDraggingRef.current) return;

                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.releasePointerCapture?.(event.pointerId);
                const nextTime = getTimeFromPointer(event.clientX) ?? dragTime;
                seekToPointerTime(nextTime, event, false, true);
            }}
            onPointerCancel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!isDraggingRef.current) return;
                seekToPointerTime(dragTime, event, false);
            }}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onKeyDown={(event) => {
                if (!safeDuration) return;

                const step = event.shiftKey ? 10 : 5;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    seekToPointerTime(safeTime - step, event, false);
                }
                if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    seekToPointerTime(safeTime + step, event, false);
                }
                if (event.key === 'Home') {
                    event.preventDefault();
                    seekToPointerTime(0, event, false);
                }
                if (event.key === 'End') {
                    event.preventDefault();
                    seekToPointerTime(safeDuration, event, false);
                }
            }}
        >
            <div className={trackClass}>
                <div className={`pointer-events-none absolute h-full rounded-full ${sliderAccentClass}`} style={{ width: `${fillPercent}%` }} />
            </div>
            <div className={thumbClass} />
        </div>
    );
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
    const viewCountRequestInFlight = useRef(false);
    const reachedThresholds = useRef<Record<number, boolean>>({});

    const sendEvent = useCallback(async (type: string, extra = {}): Promise<{ ok: boolean; viewCounted?: boolean }> => {
        if (!tracking?.playbackSessionId) return { ok: false };
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
                return { ok: false };
            }

            const data = await res.json().catch(() => ({}));
            return { ok: res.ok, viewCounted: data?.viewCounted === true };
        } catch (e) {
            console.warn("Failed to send playback event", type, e);
            return { ok: false };
        }
    }, [video.id, tracking?.playbackSessionId, refreshPlaybackPlan]);


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
            if (result.viewCounted) {
                onViewCounted?.();
            }
        }

        viewCountRequestInFlight.current = false;
    }, [onViewCounted, sendEvent]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        setHasStartedPlayback(false);
        hasReached10s.current = false;
        viewCountRequestInFlight.current = false;
        reachedThresholds.current = {};
    }, [video.id, videoUrl, videoEmbedUrl, videoSourceKind, tracking?.playbackSessionId]);

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

    return (
        <div className="relative w-full h-full min-h-0 sm:min-h-[220px] bg-black rounded-xl overflow-hidden shadow-2xl group">
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
                    muted={playerConfig ? playerConfig.mutedAutoplay : variant === 'hero'}
                    autoPlay={playerConfig ? (playerConfig.autoplayAllowed && playerConfig.mutedAutoplay) : variant === 'hero'}
                    playsInline
                    controls={false}
                    aspectRatio="16/9"
                    onCanPlay={() => sendEvent('PLAYER_READY')}
                    onPlay={() => {
                        if (!hasStartedPlayback) {
                            setHasStartedPlayback(true);
                            sendEvent('PLAY_STARTED');
                        }
                    }}
                    onPause={() => sendEvent('PLAY_PAUSED')}
                    onEnded={() => {
                        void sendEvent('ENDED');
                        if (player.current) {
                            void maybeSendView(player.current.currentTime, player.current.duration);
                        }
                    }}
                    onSeeked={(e: any) => {
                        const detailTime = typeof e.detail === 'number' ? e.detail : e.detail?.currentTime;
                        const currentTime = Number.isFinite(detailTime) ? detailTime : player.current?.currentTime || 0;
                        sendEvent('SEEKED', { positionMs: Math.floor(currentTime * 1000) });
                    }}
                    onWaiting={() => sendEvent('BUFFERING_STARTED')}
                    onPlaying={() => {
                        setHasStartedPlayback(true);
                        sendEvent('BUFFERING_ENDED');
                    }}
                    onTimeUpdate={(e: any) => {
                        const detail = typeof e.detail === 'number' ? { currentTime: e.detail, duration: player.current?.duration } : e.detail || {};
                        const currentTime = Number.isFinite(detail.currentTime) ? detail.currentTime : player.current?.currentTime || 0;
                        const duration = Number.isFinite(detail.duration) ? detail.duration : player.current?.duration;
                        if (currentTime > 0 && !hasStartedPlayback) {
                            setHasStartedPlayback(true);
                        }

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
                    <PlayerTapTarget />
                    <Captions className="pointer-events-none absolute inset-x-4 bottom-24 z-20 select-none text-center text-base font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.9)] sm:bottom-28 sm:text-lg" />
                    {(playerConfig ? playerConfig.controls : true) && <PolutekVideoControls hasTextTracks={hasTextTracks} />}
                </MediaPlayer>
            )}
        </div>
    );
}
