'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { registerPlaybackCollector } from './beacon-queue';
import { PlaybackQoeTracker, playedRanges, watchedBitmapHex } from './playback-qoe';

interface PlayerLike {
  duration: number;
  state?: { played?: TimeRanges };
}

export interface PlaybackQoeHandlers {
  playRequested(): void;
  playing(): void;
  waiting(): void;
  seekStarted(): void;
  paused(): void;
  ended(): void;
  qualityChanged(height: number | null | undefined, bitrate: number | null | undefined): void;
  error(code: string, fatal: boolean): void;
}

/**
 * Playback quality of the mounted video for the analytics beacon (lib/telemetry/client). One tracker
 * per video version; its numbers leave the page only with the page's beacons (no request per event).
 */
export function usePlaybackQoe(videoId: string, streamKey: string | null, playerRef: RefObject<PlayerLike | null>): PlaybackQoeHandlers {
  const trackerRef = useRef<PlaybackQoeTracker | null>(null);

  useEffect(() => {
    const tracker = new PlaybackQoeTracker(videoId);
    trackerRef.current = tracker;
    const unregister = registerPlaybackCollector(tracker.attempt, (final) => {
      const current = playerRef.current;
      const watched = current ? watchedBitmapHex(playedRanges(current.state?.played), current.duration) : null;
      return tracker.collect(watched, final);
    });
    return () => {
      unregister();
      if (trackerRef.current === tracker) trackerRef.current = null;
    };
  }, [videoId, streamKey, playerRef]);

  return useMemo<PlaybackQoeHandlers>(
    () => ({
      playRequested: () => trackerRef.current?.playRequested(),
      playing: () => trackerRef.current?.playing(),
      waiting: () => trackerRef.current?.waiting(),
      seekStarted: () => trackerRef.current?.seekStarted(),
      paused: () => trackerRef.current?.paused(),
      ended: () => trackerRef.current?.ended(),
      qualityChanged: (height, bitrate) => trackerRef.current?.qualityChanged(height, bitrate),
      error: (code, fatal) => trackerRef.current?.error(code, fatal),
    }),
    [],
  );
}
