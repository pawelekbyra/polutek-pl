"use client";

import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { type VideoTextTrackDTO } from '@/app/types/video';

// Note: videojs types are typically available via the videojs namespace
// or by importing the types explicitly if needed.
import type Player from 'video.js/dist/types/player';

export type VideoJsPlayerProps = {
  src: string;
  title: string;
  poster?: string | null;
  textTracks?: VideoTextTrackDTO[];
  muted?: boolean;
  autoPlay?: boolean;
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

/**
 * VideoJsPlayer is a thin React wrapper around Video.js.
 * It provides a stable, responsive player UI with built-in controls.
 */
export default function VideoJsPlayer(props: VideoJsPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  const {
    src,
    poster,
    textTracks,
    muted,
    autoPlay,
    onReady,
    onPlay,
    onPause,
    onEnded,
    onSeeked,
    onBufferingStarted,
    onBufferingEnded,
    onTimeUpdate,
    onError
  } = props;

  // We use a ref for props to avoid re-initializing the player when callbacks change,
  // while still being able to call the latest version of the callback.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const getMimeType = (url: string) => {
    try {
        const pathname = new URL(url).pathname.toLowerCase();
        if (pathname.endsWith('.m3u8')) return 'application/x-mpegURL';
        if (pathname.endsWith('.mpd')) return 'application/dash+xml';
        return undefined;
    } catch {
        const base = url.toLowerCase().split('?')[0];
        if (base.endsWith('.m3u8')) return 'application/x-mpegURL';
        if (base.endsWith('.mpd')) return 'application/dash+xml';
        return undefined;
    }
  };

  useEffect(() => {
    // Initializing Video.js
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const mimeType = getMimeType(src);

      const player = playerRef.current = videojs(videoElement, {
        autoplay: autoPlay,
        controls: true,
        responsive: true,
        fluid: true,
        aspectRatio: '16:9',
        poster: poster || undefined,
        muted: muted,
        playsinline: true,
        sources: [{
          src,
          type: mimeType
        }],
        userActions: {
          hotkeys: true
        }
      }, () => {
        propsRef.current.onReady?.();
      });

      // Event Mapping
      player.on('play', () => propsRef.current.onPlay?.());
      player.on('pause', () => propsRef.current.onPause?.());
      player.on('ended', () => propsRef.current.onEnded?.());
      player.on('waiting', () => propsRef.current.onBufferingStarted?.());
      player.on('playing', () => propsRef.current.onBufferingEnded?.());
      player.on('seeked', () => propsRef.current.onSeeked?.(player.currentTime() || 0));
      player.on('timeupdate', () => {
        propsRef.current.onTimeUpdate?.(player.currentTime() || 0, player.duration() || 0);
      });
      player.on('error', () => {
        const error = player.error();
        propsRef.current.onError?.(error ? String(error.code) : 'UNKNOWN');
      });

      // Add initial text tracks
      if (textTracks && textTracks.length > 0) {
        textTracks.forEach(track => {
          player.addRemoteTextTrack({
            kind: track.kind as any,
            src: track.src,
            srclang: track.language,
            label: track.label,
            default: track.default
          }, false);
        });
      }
    }
  }, []); // Only initialize once

  // Dispose player on unmount
  useEffect(() => {
    return () => {
      const player = playerRef.current;
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // Sync source and poster changes without re-initializing
  useEffect(() => {
    const player = playerRef.current;
    if (player && src) {
      const mimeType = getMimeType(src);
      const currentSrc = player.currentSrc();

      if (currentSrc !== src) {
        player.src({
          src,
          type: mimeType
        });
      }
    }
  }, [src]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && poster !== undefined) {
      player.poster(poster || '');
    }
  }, [poster]);

  // Sync text tracks if they change
  useEffect(() => {
    const player = playerRef.current;
    if (player && textTracks) {
        // Remove existing remote tracks to avoid duplicates
        const existingTracks = player.remoteTextTracks();
        for (let i = existingTracks.length - 1; i >= 0; i--) {
            const track = (existingTracks as any)[i];
            if (track) {
                player.removeRemoteTextTrack(track);
            }
        }

        textTracks.forEach(track => {
            player.addRemoteTextTrack({
                kind: track.kind as any,
                src: track.src,
                srclang: track.language,
                label: track.label,
                default: track.default
            }, false);
        });
    }
  }, [textTracks]);

  return (
    <div data-vjs-player className="w-full h-full bg-black">
      <div ref={videoRef} className="w-full h-full" />
    </div>
  );
}
