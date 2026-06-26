"use client";

import React, { useEffect, useRef } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

import { type VideoTextTrackDTO } from "@/app/types/video";
import { cn } from "@/lib/utils";

export type VideoJsPlaybackSnapshot = {
  currentTime: number;
  duration: number;
  paused: boolean;
};

export type VideoJsPlayerHandle = {
  getSnapshot: () => VideoJsPlaybackSnapshot;
};

export type VideoJsPlayerProps = {
  src: string;
  title: string;
  poster?: string | null;
  textTracks?: VideoTextTrackDTO[];
  controls?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  className?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onSeeked?: (currentTimeSeconds: number) => void;
  onBufferingStarted?: () => void;
  onBufferingEnded?: () => void;
  onTimeUpdate?: (currentTimeSeconds: number, durationSeconds: number) => void;
  onError?: (errorCode: string) => void;
};

function getMimeType(src: string): string | undefined {
  const pathname = (() => {
    try {
      return new URL(src).pathname.toLowerCase();
    } catch {
      return src.toLowerCase();
    }
  })();

  if (pathname.endsWith(".m3u8")) return "application/x-mpegURL";
  if (pathname.endsWith(".mpd")) return "application/dash+xml";
  if (pathname.endsWith(".mp4")) return "video/mp4";
  if (pathname.endsWith(".webm")) return "video/webm";

  return undefined;
}

function toFiniteSeconds(value: number | undefined): number {
  return Number.isFinite(value) && typeof value === "number" ? value : 0;
}

export default function VideoJsPlayer({
  src,
  title,
  poster,
  textTracks = [],
  controls = true,
  muted = false,
  autoPlay = false,
  className,
  onReady,
  onPlay,
  onPause,
  onEnded,
  onSeeked,
  onBufferingStarted,
  onBufferingEnded,
  onTimeUpdate,
  onError,
}: VideoJsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const callbacksRef = useRef({
    onReady,
    onPlay,
    onPause,
    onEnded,
    onSeeked,
    onBufferingStarted,
    onBufferingEnded,
    onTimeUpdate,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onReady,
      onPlay,
      onPause,
      onEnded,
      onSeeked,
      onBufferingStarted,
      onBufferingEnded,
      onTimeUpdate,
      onError,
    };
  }, [
    onReady,
    onPlay,
    onPause,
    onEnded,
    onSeeked,
    onBufferingStarted,
    onBufferingEnded,
    onTimeUpdate,
    onError,
  ]);

  useEffect(() => {
    if (!videoRef.current) return;

    const player = videojs(videoRef.current, {
      autoplay: autoPlay,
      controls,
      fluid: true,
      responsive: true,
      fill: true,
      muted,
      playsinline: true,
      preload: "metadata",
      poster: poster || undefined,
      sources: [{ src, type: getMimeType(src) }],
      html5: {
        vhs: {
          overrideNative: false,
        },
      },
    });

    playerRef.current = player;

    const currentTime = () => toFiniteSeconds(player.currentTime());
    const duration = () => toFiniteSeconds(player.duration());

    player.ready(() => callbacksRef.current.onReady?.());
    player.on("play", () => callbacksRef.current.onPlay?.());
    player.on("pause", () => callbacksRef.current.onPause?.());
    player.on("ended", () => callbacksRef.current.onEnded?.());
    player.on("seeked", () => callbacksRef.current.onSeeked?.(currentTime()));
    player.on("waiting", () => callbacksRef.current.onBufferingStarted?.());
    player.on("playing", () => callbacksRef.current.onBufferingEnded?.());
    player.on("timeupdate", () =>
      callbacksRef.current.onTimeUpdate?.(currentTime(), duration()),
    );
    player.on("error", () => {
      const code = player.error()?.code;
      callbacksRef.current.onError?.(
        code ? `VIDEOJS_${code}` : "VIDEOJS_ERROR",
      );
    });

    return () => {
      playerRef.current = null;
      player.dispose();
    };
  }, [autoPlay, controls, muted, poster, src]);

  return (
    <div
      className={cn("video-js-shell h-full w-full", className)}
      data-testid="videojs-player-shell"
    >
      <div data-vjs-player className="h-full w-full">
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered h-full w-full"
          title={title}
          playsInline
        >
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
        </video>
      </div>
    </div>
  );
}
