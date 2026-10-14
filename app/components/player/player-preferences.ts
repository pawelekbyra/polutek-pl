/**
 * The viewer's own quality and speed choices (settings menu of the player), kept in localStorage like
 * the captions and sound choices. Only the viewer's actions write them; blocked storage just means
 * the choice lasts until the page reloads.
 */
export const QUALITY_STORAGE_KEY = "polutek:player-quality";
export const RATE_STORAGE_KEY = "polutek:player-rate";

/** Speeds offered in the menu (the 0.25x of the player library is deliberately left out). */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type QualityPreference = "auto" | number;

let memoryQuality: QualityPreference = "auto";
let memoryRate = 1;

/** "auto" or a rendition height in pixels (e.g. 720). */
export function readQualityPreference(): QualityPreference {
  try {
    const raw = localStorage.getItem(QUALITY_STORAGE_KEY);
    if (raw === null || raw === "auto") return raw === "auto" ? "auto" : memoryQuality;
    const height = Number(raw);
    return Number.isInteger(height) && height > 0 && height <= 8640 ? height : "auto";
  } catch {
    return memoryQuality;
  }
}

export function writeQualityPreference(value: QualityPreference): void {
  memoryQuality = value;
  try {
    localStorage.setItem(QUALITY_STORAGE_KEY, String(value));
  } catch {
    // Blocked storage: memoryQuality carries the choice for this page.
  }
}

export function readRatePreference(): number {
  try {
    const raw = localStorage.getItem(RATE_STORAGE_KEY);
    if (raw === null) return memoryRate;
    const rate = Number(raw);
    return (PLAYBACK_RATES as readonly number[]).includes(rate) ? rate : 1;
  } catch {
    return memoryRate;
  }
}

export function writeRatePreference(rate: number): void {
  memoryRate = rate;
  try {
    if (rate === 1) localStorage.removeItem(RATE_STORAGE_KEY);
    else localStorage.setItem(RATE_STORAGE_KEY, String(rate));
  } catch {
    // Blocked storage: memoryRate carries the choice for this page.
  }
}

/** The rendition to lock for a saved height: the exact one, else none (stay on Auto). */
export function pickQualityIndexForHeight(
  qualities: readonly { height: number }[],
  height: QualityPreference,
): number {
  if (height === "auto") return -1;
  return qualities.findIndex((quality) => quality.height === height);
}
