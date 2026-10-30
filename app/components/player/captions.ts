"use client";

import { useSyncExternalStore } from "react";

/**
 * Captions: the viewer's on/off choice and the choice of the track.
 *
 * The choice is a viewer preference kept in localStorage (it survives a new tab or visit, like a
 * TV's subtitle setting). Captions are on by default; the selected language is remembered separately.
 * Only the viewer's own actions write preferences, through the CC control or settings menu.
 */
export const CAPTIONS_STORAGE_KEY = "polutek:captions";
export const CAPTION_LANGUAGE_STORAGE_KEY = "polutek:caption-language";

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

/** The last selected subtitle language, or null when the viewer has not picked one. */
export function readCaptionLanguage(): string | null {
  try {
    return localStorage.getItem(CAPTION_LANGUAGE_STORAGE_KEY) || null;
  } catch {
    return null;
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

/** Persist the explicit track choice while keeping the existing `off` preference compatible. */
export function writeCaptionLanguage(language: string): void {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return;
  try {
    localStorage.setItem(CAPTION_LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Storage may be blocked; Vidstack still keeps the active track for this page.
  }
  for (const listener of languageListeners) listener();
}

const languageListeners = new Set<() => void>();

function subscribeLanguage(listener: () => void): () => void {
  languageListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CAPTION_LANGUAGE_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    languageListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The explicit subtitle choice; null means choose by page language. */
export function useCaptionLanguage(): string | null {
  return useSyncExternalStore(subscribeLanguage, readCaptionLanguage, () => null);
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
 * Preferred caption track: saved explicit choice, then an exact page-language match, then the same
 * primary language (a track tagged "en-GB" serves an "en" page), finally the first available track.
 */
export function pickCaptionTrack<T extends CaptionTrackLike>(tracks: readonly T[], language: string, preferredLanguage?: string | null): T | null {
  const captions = tracks.filter((track) => track.kind === "subtitles" || track.kind === "captions");
  const wanted = language.trim().toLowerCase();
  const preferred = preferredLanguage?.trim().toLowerCase();
  const saved = preferred
    ? captions.find((track) => track.language.trim().toLowerCase() === preferred) ??
      captions.find((track) => primarySubtag(track.language) === primarySubtag(preferred))
    : undefined;
  const pageMatch = wanted
    ? captions.find((track) => track.language.trim().toLowerCase() === wanted) ??
      captions.find((track) => primarySubtag(track.language) === primarySubtag(wanted))
    : undefined;
  return saved ?? pageMatch ?? captions[0] ?? null;
}
