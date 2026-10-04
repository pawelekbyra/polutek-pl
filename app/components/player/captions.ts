"use client";

import { useSyncExternalStore } from "react";

/**
 * Captions: the viewer's on/off choice and the choice of the track.
 *
 * The choice is a viewer preference kept in localStorage (it survives a new tab or visit, like a
 * TV's subtitle setting). Captions are on by default whenever the video has a track in the page
 * language. Only the viewer's own actions write it: the CC button and the "c" key both go through
 * Vidstack's text-track change request (VideoPlayer's onMediaTextTrackChangeRequest).
 */
export const CAPTIONS_STORAGE_KEY = "polutek:captions";

const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): the choice then lasts until the page reloads.
let memoryEnabled = true;

export function readCaptionsEnabled(): boolean {
  try {
    return localStorage.getItem(CAPTIONS_STORAGE_KEY) !== "off";
  } catch {
    return memoryEnabled;
  }
}

export function writeCaptionsEnabled(enabled: boolean): void {
  memoryEnabled = enabled;
  try {
    if (enabled) localStorage.removeItem(CAPTIONS_STORAGE_KEY);
    else localStorage.setItem(CAPTIONS_STORAGE_KEY, "off");
  } catch {
    // Blocked storage: memoryEnabled carries the choice for this page.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the choice.
  const onStorage = (event: StorageEvent) => {
    if (event.key === CAPTIONS_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The viewer's captions choice; on during server render (the default). */
export function useCaptionsEnabled(): boolean {
  return useSyncExternalStore(subscribe, readCaptionsEnabled, () => true);
}

type CaptionTrackLike = { kind: string; language: string };

function primarySubtag(language: string): string {
  return language.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

/**
 * The caption track for the page language: an exact language match first, then the same primary
 * language (a track tagged "en-GB" serves an "en" page). There is no cross-language fallback on
 * purpose: Polish viewers are not shown English captions or the other way round; without a track in
 * the page language the player has no captions and no CC button.
 */
export function pickCaptionTrack<T extends CaptionTrackLike>(tracks: readonly T[], language: string): T | null {
  const captions = tracks.filter((track) => track.kind === "subtitles" || track.kind === "captions");
  const wanted = language.trim().toLowerCase();
  if (!wanted) return null;
  return (
    captions.find((track) => track.language.trim().toLowerCase() === wanted) ??
    captions.find((track) => primarySubtag(track.language) === primarySubtag(wanted)) ??
    null
  );
}
