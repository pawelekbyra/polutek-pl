"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useVideoAccess } from "./PremiumWrapper";
import {
  PublicVideoDTO as VideoType,
  type VideoTextTrackDTO,
} from "@/app/types/video";
import { cn } from "@/lib/utils";
import { PlayerErrorOverlay } from "./PlayerErrorOverlay";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { resolvePlaybackSource } from "./playback-source";
import { shouldSendViewForPlaybackPosition } from "./video-view-threshold";
import VideoJsPlayer from "./VideoJsPlayer";

interface VideoPlayerProps {
  video: VideoType;
  variant?: "hero" | "thumbnail";
  onViewCounted?: () => void;
}

function PolutekWatermark() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex h-11 w-11 rotate-3 items-center justify-center rounded-[1.15rem] border-2 border-sky-300/80 bg-white/88 text-2xl font-black italic text-sky-600 shadow-[3px_4px_0_rgba(14,165,233,0.28)] ring-1 ring-white/60 backdrop-blur-sm sm:right-5 sm:top-5">
      <span className="-translate-y-0.5 font-serif drop-shadow-[1px_1px_0_rgba(255,255,255,0.95)]">
        P
      </span>
      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-300 shadow-sm" />
    </div>
  );
}

function normalizeTextTracks(
  tracks: VideoTextTrackDTO[] | undefined,
): VideoTextTrackDTO[] {
  if (!Array.isArray(tracks)) return [];

  return tracks.filter((track) => {
    const src = track.src?.trim();
    const label = track.label?.trim();
    const language = track.language?.trim();
    return Boolean(
      src &&
      label &&
      language &&
      (track.kind === "subtitles" || track.kind === "captions"),
    );
  });
}

export default function VideoPlayer({
  video,
  variant = "hero",
  onViewCounted,
}: VideoPlayerProps) {
  const { playbackPlan, refreshPlaybackPlan, isLoading } = useVideoAccess();
  const { orgRole } = useAuth();
  const isAdmin = orgRole === "admin" || orgRole === "org:admin";
  const [playerKey, setPlayerKey] = useState(0);
  const { source, tracking, player: playerConfig } = playbackPlan || {};
  const videoUrl = source?.playbackUrl;
  const videoSourceKind = source?.kind;
  const videoEmbedUrl = source?.embedUrl;
  const textTracks = normalizeTextTracks(
    playerConfig?.textTracks || video.textTracks,
  );

  const posterUrl = playerConfig?.poster || video.thumbnailUrl || "/logo.png";
  const [isMounted, setIsMounted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const hasReached10s = useRef(false);
  const viewCountRequestInFlight = useRef(false);
  const reachedThresholds = useRef<Record<number, boolean>>({});
  const playerSnapshot = useRef({ currentTime: 0, duration: 0, paused: true });

  const sendEvent = useCallback(
    async (
      type: string,
      extra = {},
    ): Promise<{ ok: boolean; viewCounted?: boolean }> => {
      if (!tracking?.playbackSessionId) return { ok: false };
      try {
        const snapshot = playerSnapshot.current;
        const res = await fetch(`/api/videos/${video.id}/playback-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: tracking.playbackSessionId,
            type,
            positionMs: Math.floor(snapshot.currentTime * 1000),
            durationMs: Math.floor(snapshot.duration * 1000),
            ...extra,
          }),
        });

        if (res.status === 403) {
          const { error } = await res.json();
          if (error === "SESSION_EXPIRED") {
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
    },
    [video.id, tracking?.playbackSessionId, refreshPlaybackPlan],
  );

  const maybeSendView = useCallback(
    async (currentTimeSeconds: number, durationSeconds?: number) => {
      if (
        hasReached10s.current ||
        viewCountRequestInFlight.current ||
        !shouldSendViewForPlaybackPosition(currentTimeSeconds, durationSeconds)
      )
        return;

      viewCountRequestInFlight.current = true;
      const durationMs =
        Number.isFinite(durationSeconds) &&
        durationSeconds &&
        durationSeconds > 0
          ? Math.floor(durationSeconds * 1000)
          : 0;
      const result = await sendEvent("WATCHED_10_SECONDS", {
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
    },
    [onViewCounted, sendEvent],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setHasStartedPlayback(false);
    hasReached10s.current = false;
    viewCountRequestInFlight.current = false;
    reachedThresholds.current = {};
    playerSnapshot.current = { currentTime: 0, duration: 0, paused: true };
  }, [
    video.id,
    videoUrl,
    videoEmbedUrl,
    videoSourceKind,
    tracking?.playbackSessionId,
  ]);

  useEffect(() => {
    if (!isMounted || !tracking?.playbackSessionId) return;
    const interval = setInterval(
      () => {
        if (playerSnapshot.current.paused === false) {
          sendEvent("HEARTBEAT");
        }
      },
      (tracking.heartbeatIntervalSeconds || 15) * 1000,
    );
    return () => clearInterval(interval);
  }, [isMounted, tracking, sendEvent]);

  // PremiumWrapper owns the single player loading placeholder. Avoid adding a nested skeleton here.
  if (!isMounted || isLoading) {
    return null;
  }

  // Optimized Thumbnail Variant: No player engine, just a static preview
  if (variant === "thumbnail") {
    return (
      <div
        className={cn(
          "relative w-full h-full group/player overflow-hidden bg-neutral-900",
          "cursor-default",
        )}
      >
        <Image
          src={posterUrl}
          alt={video.title || "Video poster"}
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

  if (resolvedSource.mode === "unavailable") {
    const errorCode = resolvedSource.reason.startsWith("missing")
      ? "NO_PLAYBACK_URL"
      : "UNSUPPORTED_SOURCE";

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
      ) : resolvedSource.mode === "embed" ? (
        <iframe
          className="h-full w-full border-0"
          src={resolvedSource.src}
          title={playerConfig?.title || video.title || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <VideoJsPlayer
          key={playerKey}
          className="[&_.video-js]:h-full [&_.video-js]:w-full [&_.video-js]:bg-black [&_.video-js]:text-white [&_.vjs-control-bar]:max-w-full [&_.vjs-control-bar]:overflow-hidden [&_video]:object-cover"
          title={playerConfig?.title || video.title || "Video"}
          src={resolvedSource.src}
          poster={posterUrl}
          textTracks={textTracks}
          controls={playerConfig ? playerConfig.controls : true}
          muted={playerConfig ? playerConfig.mutedAutoplay : variant === "hero"}
          autoPlay={
            playerConfig
              ? playerConfig.autoplayAllowed && playerConfig.mutedAutoplay
              : variant === "hero"
          }
          onReady={() => sendEvent("PLAYER_READY")}
          onPlay={() => {
            playerSnapshot.current.paused = false;
            setHasStartedPlayback(true);
            sendEvent("PLAY_STARTED");
          }}
          onPause={() => {
            playerSnapshot.current.paused = true;
            sendEvent("PLAY_PAUSED");
          }}
          onEnded={() => {
            playerSnapshot.current.paused = true;
            void sendEvent("ENDED");
            void maybeSendView(
              playerSnapshot.current.currentTime,
              playerSnapshot.current.duration,
            );
          }}
          onSeeked={(currentTime) => {
            playerSnapshot.current.currentTime = currentTime;
            sendEvent("SEEKED", { positionMs: Math.floor(currentTime * 1000) });
          }}
          onBufferingStarted={() => sendEvent("BUFFERING_STARTED")}
          onBufferingEnded={() => {
            playerSnapshot.current.paused = false;
            setHasStartedPlayback(true);
            sendEvent("BUFFERING_ENDED");
          }}
          onTimeUpdate={(currentTime, duration) => {
            playerSnapshot.current.currentTime = currentTime;
            playerSnapshot.current.duration = duration;
            if (currentTime > 0 && !hasStartedPlayback) {
              setHasStartedPlayback(true);
            }

            void maybeSendView(currentTime, duration);

            const pct = duration ? (currentTime / duration) * 100 : 0;
            const thresholds = [
              { pct: 25, type: "WATCHED_25_PERCENT" },
              { pct: 50, type: "WATCHED_50_PERCENT" },
              { pct: 75, type: "WATCHED_75_PERCENT" },
              { pct: 90, type: "WATCHED_90_PERCENT" },
            ];

            for (const threshold of thresholds) {
              if (
                pct >= threshold.pct &&
                !reachedThresholds.current[threshold.pct]
              ) {
                reachedThresholds.current[threshold.pct] = true;
                sendEvent(threshold.type);
              }
            }
          }}
          onError={(errorCode) => {
            setLoadError(
              "Nie udało się załadować materiału wideo. Sprawdź link, CORS lub dostępność źródła.",
            );
            sendEvent("PLAYER_ERROR", { errorCode });
          }}
        />
      )}
    </div>
  );
}
