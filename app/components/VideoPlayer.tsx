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
    TimeSlider,
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
import { PlayIcon, PauseIcon, VolumeIcon, MuteIcon, CaptionsIcon, FullscreenIcon } from './VideoPlayerIcons';
import { PlayerErrorOverlay } from './PlayerErrorOverlay';
import { PlayerStateFrame } from './PlayerStateFrame';
import { resolvePlaybackSource } from './playback-source';
import { shouldSendViewForPlaybackPosition } from './video-view-threshold';
import { usePlaybackTelemetry } from '@/lib/hooks/usePlaybackTelemetry';

interface VideoPlayerProps {
    video: VideoType;
    variant?: 'hero' | 'thumbnail';
    onViewCounted?: () => void;
}

const playerIconClass = "h-[1.25rem] w-[1.25rem]";
const centerPauseIconClass = "h-14 w-14 drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)]";
const sliderAccentClass = "bg-[#2563eb]";
// Played portion of the progress bar — site blue accent, matching the brand.
const PROGRESS_PLAYED_COLOR = "#2563eb";

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
            {paused ? <PlayIcon className={playerIconClass} /> : <PauseIcon className={playerIconClass} />}
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
            {paused ? <PlayIcon className={centerPauseIconClass} /> : null}
        </button>
    );
}

function PlayerMuteIcon() {
    const muted = useMediaState('muted');
    const volume = useMediaState('volume');
    const isMuted = muted || volume === 0;

    return isMuted ? <MuteIcon className={playerIconClass} /> : <VolumeIcon className={playerIconClass} />;
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
            <CaptionsIcon className={playerIconClass} />
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
    const buttonClass = "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10";
    const sliderTrackClass = "relative h-[4px] w-full rounded-full bg-white/30 ring-1 ring-black/30 transition-[height] duration-150 group-hover/slider:h-[6px] group-data-[dragging]/slider:h-[6px]";
    // Always-visible grab handle (touch devices have no hover); grows while dragging.
    const sliderThumbClass = "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[#171717]/75 bg-white shadow-[1px_1px_0_rgba(0,0,0,0.38)] transition-transform duration-150 will-change-[left] group-data-[dragging]/slider:scale-125";
    // We ship our own slider chrome instead of Vidstack's stylesheet, so fill width and thumb
    // position must be driven by Vidstack's --slider-fill / --slider-progress CSS variables —
    // the exact contract its own default CSS uses. Without these the thumb never moves.
    const fillStyle: React.CSSProperties = { width: "var(--slider-fill)" };
    const thumbStyle: React.CSSProperties = { left: "var(--slider-fill)" };

    return (
        <Controls.Root className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-2 pb-2 pt-5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[visible]:opacity-100 sm:px-3 sm:pb-3 sm:pt-7">
            {/* Progress bar: thin brand-styled line pinned just above the controls row (YouTube layout).
                Built on Vidstack's TimeSlider so seeking — including seeking after the video has ended —
                behaves correctly out of the box. */}
            <TimeSlider.Root className="group/slider relative mb-2 flex h-5 w-full cursor-pointer touch-none select-none items-center px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                <TimeSlider.Track className={sliderTrackClass}>
                    <TimeSlider.Progress className="absolute left-0 h-full rounded-full bg-white/40" style={{ width: "var(--slider-progress)" }} />
                    <TimeSlider.TrackFill className="absolute left-0 h-full rounded-full bg-[#2563eb]" style={fillStyle} />
                </TimeSlider.Track>
                <TimeSlider.Thumb className={sliderThumbClass} style={thumbStyle} />
            </TimeSlider.Root>

            <Controls.Group className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1.5">
                    <PlayerPlayButton className={buttonClass} />

                    <div className="group/vol flex shrink-0 items-center">
                        <MuteButton className={buttonClass} aria-label="Wycisz / włącz dźwięk"><PlayerMuteIcon /></MuteButton>
                        <VolumeSlider.Root
                            className="group/slider invisible relative hidden h-10 w-0 shrink-0 cursor-pointer touch-none select-none items-center px-1.5 opacity-0 outline-none transition-[width,opacity] duration-200 ease-out group-hover/vol:visible group-hover/vol:w-20 group-hover/vol:opacity-100 group-focus-within/vol:visible group-focus-within/vol:w-20 group-focus-within/vol:opacity-100 md:flex"
                            aria-label="Głośność"
                        >
                            <VolumeSlider.Track className={sliderTrackClass}>
                                <VolumeSlider.TrackFill className={`pointer-events-none absolute left-0 h-full rounded-full ${sliderAccentClass}`} style={fillStyle} />
                            </VolumeSlider.Track>
                            <VolumeSlider.Thumb className={sliderThumbClass} style={thumbStyle} />
                        </VolumeSlider.Root>
                    </div>

                    <PlayerTimeReadout />
                </div>

                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
                    <PlayerCaptionButton className={buttonClass} disabled={!hasTextTracks} />
                    <FullscreenButton className={buttonClass} aria-label="Pełny ekran"><FullscreenIcon className={playerIconClass} /></FullscreenButton>
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
                    onCanPlay={() => {
                        // A video chosen after the viewer has already interacted with the page
                        // (sticky user activation) may play with sound — browsers only force
                        // muted autoplay before the first interaction. So switching videos
                        // starts audible instead of silently muted.
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
