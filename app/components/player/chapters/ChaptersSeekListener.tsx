"use client";

import { useEffect } from "react";
import { useMediaPlayer } from "@vidstack/react";
import { SEEK_REQUEST_EVENT, type SeekRequestDetail } from "../seek-request";
import { seekPlayerTo } from "./seek-player";

/**
 * Performs the jumps asked for from outside the player (requestSeek: the times in the description, the chapter list
 * under it). On a phone the player may be scrolled out of view by then, so it is brought back (no animation with
 * reduced motion).
 */
export function ChaptersSeekListener({ videoId }: { videoId: string }) {
  const player = useMediaPlayer();

  useEffect(() => {
    if (!player) return;
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<SeekRequestDetail>).detail;
      if (!detail || detail.videoId !== videoId) return;
      seekPlayerTo(player, detail.seconds);
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      player.el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    };
    window.addEventListener(SEEK_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(SEEK_REQUEST_EVENT, onRequest);
  }, [player, videoId]);

  return null;
}
