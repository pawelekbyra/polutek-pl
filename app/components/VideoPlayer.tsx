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
import { PlayerStartLoading } from './PlayerLoadingState';
import { UnmuteHint } from './player/UnmuteHint';
import {
    mayTryAudibleAutoplay,
    readSoundPreference,
    readUserMuted,
    writeUserMuted,
    writeVolume,
} from './player/sound-preference';
import { useUnmuteOnFirstGesture } from './player/useUnmuteOnFirstGesture';
import { resolvePlaybackSource } from './playback-source';
import { shouldSendViewForPlaybackPosition } from './video-view-threshold';
import { usePlaybackTelemetry } from '@/lib/hooks/usePlaybackTelemetry';
import { usePlaybackQoe } from '@/lib/telemetry/client/use-playback-qoe';
import { shouldSkipGate, usePageRevealReady } from './preload/PageRevealGate';
import { buildSelfHlsConfig, loadHlsLibrary, streamIdentity } from './player/self-hls';
import { pickCaptionTrack, writeCaptionsEnabled } from './player/captions';
import { useOptionalLanguage } from './LanguageContext';
import { useOptionalTx } from "@/lib/i18n/language-context";

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
    /**
     * The viewer picked this video with a click or tap. That gesture lets the browser start it
     * with sound, so it does, unless the viewer muted the player themselves earlier in this
     * session (sound-preference.ts). Without it the video starts muted (autoplay policy).
     */
    startWithSound?: boolean;
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

// Vidstack's defaults, minus the playback-speed keys ("<" / ">"): the player has no speed control.
const PLAYER_KEY_SHORTCUTS = { speedUp: '', slowDown: '' };

export default function VideoPlayer({ video, onViewCounted, revealKey, startWithSound = false }: VideoPlayerProps) {
    const { playbackPlan, refreshPlaybackPlan, renewPlaybackPlan, isLoading } = useVideoAccess();
    // The player never receives admin status from the session (the server decides); admin-only
    // diagnostics in the overlays stay off for viewers.
    const isAdmin = false;
    const [playerKey, setPlayerKey] = useState(0);
    const { source, tracking, player: playerConfig } = playbackPlan || {};
    const videoUrl = source?.playbackUrl;
    const videoSourceKind = source?.kind;
    // Only the caption track in the page language is mounted (captions.ts): it is what the CC
    // switch turns on and off; without one the player has no captions and no CC button.
    const language = useOptionalLanguage();
    const tx = useOptionalTx();
    const captionTrack = pickCaptionTrack(normalizeTextTracks(playerConfig?.textTracks), language);

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
    // From the click on the entry gate until its flash the hero must stay paused at its start (the
    // warp has its own sound): any play in between (a resumed autoplay, a buffering restart) is undone.
    const gateHoldRef = useRef(false);
    // Sound. `muted` mirrors the player (and is what a remounted player starts with); until the
    // per-video reset below decides, the player is not mounted yet. `userMuted`: the viewer's own
    // mute choice this session. `isPlaying` drives the unmute hint.
    const startWithSoundRef = useRef(startWithSound);
    const [muted, setMuted] = useState(true);
    const [userMuted, setUserMuted] = useState(false);
    // The volume the viewer last set (sound-preference.ts); the player is mounted with it.
    const [startVolume, setStartVolume] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
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

    const sendEvent = usePlaybackTelemetry({
        videoId: video.id,
        playbackSessionId: tracking?.playbackSessionId,
        renewPlaybackPlan,
        playerRef: player,
    });
    // Startup, stalls, quality and errors go out with the page's analytics beacon (no request per event).
    const qoe = usePlaybackQoe(video.id, streamKey, player);

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
        setLoadError(tx('Nie udało się załadować materiału wideo. Spróbuj ponownie za chwilę.', 'Could not load the video. Please try again in a moment.'));
        qoe.error('LOAD_FAILED', true);
    }, [qoe, streamKey, tx]);

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
        setIsPlaying(false);
        // Read here, not during render: sessionStorage does not exist on the server.
        const preference = readSoundPreference();
        const chosenMute = preference.muted === true;
        setUserMuted(chosenMute);
        setStartVolume(preference.volume ?? 1);
        // With sound when the viewer picked this video by click, or when they had sound on before
        // and no entry gate is waiting for its click (a reload, Back/Forward, a later page of the
        // same session) and the browser does not rule sound autoplay out: then the browser decides
        // (onAutoPlayFail falls back to muted + the unmute button). Under the gate it stays muted.
        const audibleStart =
            !chosenMute &&
            (startWithSoundRef.current ||
                (preference.muted === false && shouldSkipGate() && mayTryAudibleAutoplay()));
        if (startWithSoundRef.current && !chosenMute) writeUserMuted(false);
        setMuted(!audibleStart);
        setPlayerKey((key) => key + 1);
        hasReached10s.current = false;
        viewCountRequestInFlight.current = false;
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

    // The entry gate. Its click is a user gesture: the hero, which autoplayed muted under the gate,
    // is paused at its start right away and given the gesture's permission to play with sound
    // ("polutek:gate-unlock": play + pause unmuted inside the click, what iOS/Safari require). It then
    // waits, paused at 0, through the entry warp (which has its own sound) and starts FROM THE
    // BEGINNING when the warp's flash covers the screen ("polutek:gate-enter"): with sound, unless the
    // viewer chose mute (then muted, still from 0). Without the warp (reduced motion) both come at
    // the click. A player that is not mounted yet starts with sound when it mounts.
    //
    // Both act on the <video> element itself: it is the source of truth, and the player library
    // follows its events. (Pausing it through the library right after the raw play+pause left the
    // library's state at "playing" while the element stood still, so a later play() was a no-op and
    // the hero never started after the warp.)
    useEffect(() => {
        const mediaOf = () => player.current?.el?.querySelector("video") ?? null;
        const handleGateEnter = () => {
            gateHoldRef.current = false;
            const viewerMuted = readUserMuted();
            if (!viewerMuted) {
                // The gate click is the viewer's own: the sound they get now is remembered.
                writeUserMuted(false);
                setMuted(false);
            }
            const current = player.current;
            if (!current) return;
            const target: { currentTime: number; muted: boolean; play: () => Promise<void> } = mediaOf() ?? current;
            target.currentTime = 0;
            target.muted = viewerMuted;
            // Refused with sound (the gesture's permission did not carry over): play muted with the
            // unmute hint rather than stay paused.
            void target.play().catch(() => {
                setMuted(true);
                target.muted = true;
                void target.play().catch(() => setAutoPlayFailed(true));
            });
        };
        const handleGateUnlock = () => {
            gateHoldRef.current = true;
            const media = mediaOf();
            if (!media) return;
            if (!readUserMuted()) {
                media.muted = false;
                void media.play()?.catch(() => undefined);
            }
            media.pause();
            media.currentTime = 0;
        };
        window.addEventListener("polutek:gate-enter", handleGateEnter);
        window.addEventListener("polutek:gate-unlock", handleGateUnlock);
        return () => {
            window.removeEventListener("polutek:gate-enter", handleGateEnter);
            window.removeEventListener("polutek:gate-unlock", handleGateUnlock);
        };
    }, []);

    // The browser refused to start with sound (no gesture it accepts, e.g. Back/Forward, or a
    // stricter policy): play muted instead and show the unmute hint, never a silent failure.
    // A refused muted start leaves the paused player with its play button.
    const handleAutoPlayFail = (detail: { muted?: boolean } | undefined) => {
        const current = player.current;
        if (detail?.muted === false && current) {
            setMuted(true);
            current.muted = true;
            void current.play().catch(() => setAutoPlayFailed(true));
            return;
        }
        setAutoPlayFailed(true);
    };

    const handleUnmuteHint = () => {
        writeUserMuted(false);
        setUserMuted(false);
        setMuted(false);
        const current = player.current;
        if (!current) return;
        current.muted = false;
        if (current.volume === 0) current.volume = readSoundPreference().volume ?? 1;
    };

    // Muted only because the browser required it (reload or Back/Forward without a gesture, or
    // sound refused), never because the viewer chose mute: the first gesture anywhere on the page
    // turns the sound on, without recording it as the viewer's choice.
    const unmuteAfterGesture = useCallback(() => {
        if (readUserMuted()) return;
        setMuted(false);
        const current = player.current;
        if (!current) return;
        current.muted = false;
        if (current.volume === 0) current.volume = readSoundPreference().volume ?? 1;
    }, []);
    useUnmuteOnFirstGesture(isMounted && muted && !userMuted, unmuteAfterGesture, playerKey);

    // The start-up frame hides as soon as the first frame renders (independent of buffering).
    const startOverlayHidden =
        hasRenderedFrame ||
        (canPlay && (!autoPlayWanted || autoPlayFailed));

    // PremiumWrapper owns the loading placeholder before this mounts. For the one pre-mount
    // frame here, keep showing the same dark start-up frame rather than an empty box, so the
    // handoff from PremiumWrapper to the player never flashes.
    if (!isMounted || isLoading) {
        return (
            <div className="relative h-full w-full">
                <PlayerStartLoading />
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
                        muted={muted}
                        volume={startVolume}
                        autoPlay={autoPlayWanted}
                        preload={autoPlayWanted ? 'auto' : undefined}
                        playsInline
                        aspectRatio="16/9"
                        controlsDelay={4000}
                        keyShortcuts={PLAYER_KEY_SHORTCUTS}
                        onCanPlay={() => {
                            setCanPlay(true);
                            const resume = resumeRef.current;
                            if (resume && player.current) {
                                resumeRef.current = null;
                                if (resume.time > 0) player.current.currentTime = resume.time;
                                if (resume.play) void player.current.play().catch(() => undefined);
                            }
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
                            // Held for the entry warp: undo the start, nothing is counted.
                            if (gateHoldRef.current) {
                                player.current?.el?.querySelector("video")?.pause();
                                return;
                            }
                            setHasStartedPlayback(true);
                            qoe.playRequested();
                            // First play starts the watch clock, every later play resumes it
                            // (the server counts watch time between these and HEARTBEAT/PAUSE).
                            sendEvent(playStartedSentRef.current ? 'PLAY_RESUMED' : 'PLAY_STARTED');
                            playStartedSentRef.current = true;
                        }}
                        onPause={() => {
                            setIsPlaying(false);
                            qoe.paused();
                            sendEvent('PLAY_PAUSED');
                        }}
                        onVolumeChange={(detail: { muted: boolean }) => {
                            setMuted(detail.muted);
                            // Our own code only unmutes when the viewer has not chosen mute, so an
                            // unmute while that choice stands is the viewer's (e.g. volume slider).
                            if (!detail.muted && userMuted) {
                                writeUserMuted(false);
                                setUserMuted(false);
                            }
                        }}
                        // Only the viewer's own actions (mute button, "m" key) arrive as requests.
                        onMediaMuteRequest={() => {
                            writeUserMuted(true);
                            setUserMuted(true);
                        }}
                        // The volume slider and the arrow keys: remembered for the next load.
                        onMediaVolumeChangeRequest={(detail: number) => writeVolume(detail)}
                        onMediaUnmuteRequest={() => {
                            writeUserMuted(false);
                            setUserMuted(false);
                        }}
                        // The viewer's own captions switch (CC button, "c" key) is remembered.
                        onMediaTextTrackChangeRequest={(detail: { mode: string }) => {
                            writeCaptionsEnabled(detail.mode === 'showing');
                        }}
                        onEnded={() => {
                            setIsPlaying(false);
                            qoe.ended();
                            void sendEvent('ENDED');
                            if (player.current) void maybeSendView(player.current.currentTime, player.current.duration);
                        }}
                        onSeeking={() => qoe.seekStarted()}
                        onWaiting={() => qoe.waiting()}
                        onQualityChange={(quality) => qoe.qualityChanged(quality?.height, quality?.bitrate)}
                        onHlsError={(detail) => qoe.error(`hls:${detail.type}:${detail.details}`, detail.fatal)}
                        onAutoPlayFail={handleAutoPlayFail}
                        onPlaying={() => {
                            setIsPlaying(true);
                            setHasStartedPlayback(true);
                            setHasRenderedFrame(true);
                            recoveryAttemptedRef.current = false;
                            qoe.playing();
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
                        }}
                        onProviderChange={handleProviderChange}
                        onError={(detail) => {
                            qoe.error(`media:${detail?.code ?? 0}`, false);
                            void handleMediaError();
                        }}
                    >
                        <MediaProvider>
                            {captionTrack && (
                                // No `default`: CaptionsSync applies the viewer's on/off choice.
                                <Track
                                    key={`${captionTrack.kind}:${captionTrack.language}:${captionTrack.src}`}
                                    src={captionTrack.src}
                                    kind={captionTrack.kind}
                                    label={captionTrack.label}
                                    language={captionTrack.language}
                                    type="vtt"
                                />
                            )}
                        </MediaProvider>
                        {(playerConfig ? playerConfig.controls : true) && <PolutekControls />}
                    </MediaPlayer>
                    {!bufferingOverlayTimedOut && (
                        // Same dark start-up frame the access check showed, so the handoff from
                        // PremiumWrapper to the mounted player is seamless; it fades out on the
                        // first real frame instead of cutting away.
                        <div className="absolute inset-0 z-30 pointer-events-none">
                            <PlayerStartLoading hidden={startOverlayHidden} ready={canPlay} />
                        </div>
                    )}
                    <UnmuteHint visible={isPlaying && muted && !userMuted} onUnmute={handleUnmuteHint} />
                </div>
            )}
        </div>
    );
}
