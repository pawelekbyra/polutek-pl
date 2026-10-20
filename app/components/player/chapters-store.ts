import { useSyncExternalStore } from "react";
import type { Chapter } from "@/lib/video-chapters";

/**
 * What the player knows about the chapters of the video on screen, for components that live outside the player (the
 * card under it: clickable times and the chapter list). `useVideoAccess()` only works inside PremiumWrapper, and the
 * chapters come with the playback plan, so ChaptersTrackSync (inside the player) writes them here, per video.
 * An entry exists only while a player is mounted for that video: `durationSeconds` is null until its length is
 * known, `chapters` is empty for a video without chapters. Guests of a LOGGED_IN video never get a player, so
 * never an entry (no chapter title reaches them).
 */
export interface ChaptersEntry {
  chapters: readonly Chapter[];
  durationSeconds: number | null;
  /** Index of the chapter being played (-1 when none). */
  activeIndex: number;
}

const entries = new Map<string, ChaptersEntry>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function publishChapters(videoId: string, chapters: readonly Chapter[], durationSeconds: number | null): void {
  const previous = entries.get(videoId);
  entries.set(videoId, { chapters, durationSeconds, activeIndex: previous?.activeIndex ?? -1 });
  emit();
}

export function publishActiveChapter(videoId: string, activeIndex: number): void {
  const previous = entries.get(videoId);
  if (!previous || previous.activeIndex === activeIndex) return;
  entries.set(videoId, { ...previous, activeIndex });
  emit();
}

export function clearChapters(videoId: string): void {
  if (entries.delete(videoId)) emit();
}

export function useVideoChapters(videoId: string): ChaptersEntry | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => entries.get(videoId) ?? null,
    () => null,
  );
}
