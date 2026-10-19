import { notFound } from "next/navigation";
import { SHOW_SECTION_NAV } from "@/lib/ui-flags";
import { isLocale } from "@/lib/i18n/routing";

/** Sections of the service (prototype, flag SHOW_SECTION_NAV). */
export type SectionId = "video" | "photos" | "shop";

export const SECTION_IDS: readonly SectionId[] = ["video", "photos", "shop"];

/** Page of the Video section: the home page and everything a viewer reaches from it. */
const VIDEO_SEGMENTS = new Set(["(home)", "watch", "channel", "playlist", "playlista", "search"]);

/**
 * Section a route belongs to, or null when the section navigation must stay hidden there (Studio, admin,
 * legal pages, account pages, sign-in callbacks, ...). Takes the selected layout segments of the root
 * layout (router state, not the address bar: UrlMask rewrites the visible URL to "/"), e.g.
 * ["pl", "watch", "some-film"] or ["en", "photos"].
 */
export function sectionFromSegments(segments: readonly string[]): SectionId | null {
  const rest = isLocale(segments[0]) ? segments.slice(1) : segments;
  const first = rest[0];
  if (first === undefined || first === "__PAGE__") return "video";
  if (first === "zdjecia" || first === "photos") return "photos";
  if (first === "sklep" || first === "shop") return "shop";
  if (VIDEO_SEGMENTS.has(first)) return "video";
  return null;
}

/** Server pages of the new sections: answers 404 when the prototype is switched off. */
export function ensureSectionsEnabled(): void {
  if (!SHOW_SECTION_NAV) notFound();
}

export const SECTION_BAR_STORAGE_KEY = "pp-section-bar-hidden";
export const SECTION_RAIL_STORAGE_KEY = "pp-section-rail-hidden";

/** Remembered "hidden" choice of a bar; false without storage (private mode, blocked data). */
export function readHiddenPreference(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeHiddenPreference(key: string, hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable: the choice just is not remembered */
  }
}
