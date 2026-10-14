"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { clampStartTime, parseStartTime } from "@/lib/video-start-time";
import { PROGRESS_MIN_SECONDS } from "@/lib/video-progress-rules";
import { readGuestProgress, sendProgressToServer, writeGuestProgress } from "./video-progress-client";
import { clearPlaybackPosition, setPlaybackPosition } from "./playback-position";

/** How often the position is reported while the video plays. */
export const PROGRESS_SAVE_INTERVAL_MS = 10_000;

export type StartSource = "link" | "resume";
export interface StartNotice {
  seconds: number;
  source: StartSource;
}

// `?t=` is read once per page load, for the first video the player shows (the one the address names),
// and then removed from the address (the canonical URL has no `t`). Kept in the module so React's
// double effect in development and a player remount see the same value.
const pageStart: { read: boolean; seconds: number | null; videoId: string | null } = {
  read: false,
  seconds: null,
  videoId: null,
};

/** @internal test helper */
export function resetPageStartForTests(): void {
  pageStart.read = false;
  pageStart.seconds = null;
  pageStart.videoId = null;
}

function readPageStart(videoId: string): void {
  if (pageStart.read || typeof window === "undefined") return;
  pageStart.read = true;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("t");
    if (raw === null) return;
    const seconds = parseStartTime(raw);
    if (seconds !== null) {
      pageStart.seconds = seconds;
      pageStart.videoId = videoId;
    }
    // Valid or not, the address goes back to its canonical form (no `t`).
    url.searchParams.delete("t");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Cosmetic only.
  }
}

interface Options {
  playerRef: RefObject<MediaPlayerInstance | null>;
  videoId: string;
  signedIn: boolean;
  /**
   * The signed-in viewer's saved position: a number, null (nothing to resume) or undefined (the
   * server answer has not arrived yet; nothing is saved meanwhile so an old position is never overwritten).
   */
  serverPositionSeconds: number | null | undefined;
  /** The entry gate holds the hero paused at its start: nothing is saved or applied then. */
  isGateHeld: () => boolean;
}

/**
 * Resume watching and `?t=` start times for the player, plus the position reports:
 * every ~10 s while playing, on pause, when the tab hides or closes (sendBeacon) and when the video
 * changes. Signed-in viewers report to the server, guests keep it in localStorage.
 * The start position: `?t=` wins over the saved position.
 */
export function useVideoProgress({ playerRef, videoId, signedIn, serverPositionSeconds, isGateHeld }: Options) {
  const [notice, setNotice] = useState<StartNotice | null>(null);
  const appliedRef = useRef(false);
  const lastSentRef = useRef<number>(-1);
  const lastKnownRef = useRef<{ position: number; duration: number | null }>({ position: 0, duration: null });
  const signedInRef = useRef(signedIn);
  const serverPositionRef = useRef(serverPositionSeconds);
  const videoIdRef = useRef(videoId);
  const gateHeldRef = useRef(isGateHeld);
  // Declared first so every later effect of the same commit reads the current props.
  useEffect(() => {
    signedInRef.current = signedIn;
    serverPositionRef.current = serverPositionSeconds;
    gateHeldRef.current = isGateHeld;
  });

  const report = useCallback((id: string, position: number, duration: number | null, beacon: boolean) => {
    if (!Number.isFinite(position) || position < PROGRESS_MIN_SECONDS) return;
    if (gateHeldRef.current()) return;
    if (signedInRef.current) {
      // The saved position is not known yet: do not overwrite it with the first seconds of a new session.
      if (serverPositionRef.current === undefined) return;
      const whole = Math.floor(position);
      if (!beacon && whole === lastSentRef.current) return;
      lastSentRef.current = whole;
      sendProgressToServer(id, position, duration, { beacon });
    } else {
      writeGuestProgress(id, position, duration);
    }
  }, []);

  // A different video: forget the previous one's state; report its last position first.
  useEffect(() => {
    const previousId = videoIdRef.current;
    if (previousId !== videoId) {
      const known = lastKnownRef.current;
      report(previousId, known.position, known.duration, true);
      clearPlaybackPosition(previousId);
    }
    videoIdRef.current = videoId;
    appliedRef.current = false;
    lastSentRef.current = -1;
    lastKnownRef.current = { position: 0, duration: null };
    setNotice(null);
    readPageStart(videoId);
  }, [videoId, report]);

  const resolveStart = useCallback((): { seconds: number; source: StartSource } | null => {
    if (pageStart.seconds !== null && pageStart.videoId === videoIdRef.current) {
      return { seconds: pageStart.seconds, source: "link" };
    }
    if (signedInRef.current) {
      const saved = serverPositionRef.current;
      return typeof saved === "number" ? { seconds: saved, source: "resume" } : null;
    }
    const guest = readGuestProgress(videoIdRef.current);
    return guest ? { seconds: guest.positionSeconds, source: "resume" } : null;
  }, []);

  /**
   * Moves the player to the start position once per video. `target` is where the position is written
   * when it is not the player itself (the entry gate acts on the <video> element). Returns whether
   * a start position was applied.
   */
  const applyStart = useCallback(
    (target?: { currentTime: number }): boolean => {
      if (appliedRef.current) return false;
      const start = resolveStart();
      if (!start) return false;
      const player = playerRef.current;
      if (!player && !target) return false;
      const duration = player && Number.isFinite(player.duration) && player.duration > 0 ? player.duration : null;
      const seconds = clampStartTime(start.seconds, duration);
      appliedRef.current = true;
      if (start.source === "link") pageStart.seconds = null;
      if (seconds <= 0) return false;
      try {
        (target ?? (player as { currentTime: number })).currentTime = seconds;
      } catch {
        return false;
      }
      setNotice({ seconds, source: start.source });
      return true;
    },
    [playerRef, resolveStart],
  );

  // The saved position arrived after the player was ready (a shallow switch): jump there if the
  // viewer has not moved on yet.
  useEffect(() => {
    if (appliedRef.current || typeof serverPositionSeconds !== "number") return;
    const player = playerRef.current;
    if (!player || gateHeldRef.current()) return;
    const ready = (player as { state?: { canPlay?: boolean } }).state?.canPlay === true;
    if (ready && (player.currentTime || 0) < 3) applyStart();
  }, [serverPositionSeconds, applyStart, playerRef]);

  /** Called on every time update: remembers the position (reports and the share menu read it). */
  const noteTime = useCallback((position: number, duration: number | null) => {
    if (!Number.isFinite(position)) return;
    lastKnownRef.current = { position, duration: duration !== null && Number.isFinite(duration) ? duration : null };
    setPlaybackPosition(videoIdRef.current, position);
  }, []);

  /** Report the current position now (pause, end). */
  const saveNow = useCallback(
    (beacon = false) => {
      const player = playerRef.current;
      const position = player && Number.isFinite(player.currentTime) ? player.currentTime : lastKnownRef.current.position;
      const rawDuration = player?.duration;
      const duration =
        typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration > 0
          ? rawDuration
          : lastKnownRef.current.duration;
      report(videoIdRef.current, position, duration, beacon);
    },
    [playerRef, report],
  );

  // Periodic report while playing, and the last report when the tab hides or closes.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (playerRef.current?.paused === false) saveNow(false);
    }, PROGRESS_SAVE_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveNow(true);
    };
    const onPageHide = () => saveNow(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      // Unmounting (leaving the page route): last known position.
      const known = lastKnownRef.current;
      report(videoIdRef.current, known.position, known.duration, true);
    };
  }, [playerRef, saveNow, report]);

  const startOver = useCallback(() => {
    const player = playerRef.current;
    if (player) player.currentTime = 0;
    setNotice(null);
  }, [playerRef]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { notice, applyStart, noteTime, saveNow, startOver, dismissNotice };
}
