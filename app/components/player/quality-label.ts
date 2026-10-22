/**
 * The short quality badge on the settings button ("4K", "HD", "SD"), from the height of the rendition being played.
 * `null` when the height is unknown (no quality list yet, a single plain file): the button then shows the gear.
 * Thresholds follow the usual broadcast names: 2160p and up is 4K, 720p and up is HD, anything lower SD.
 */
export type QualityBadge = "4K" | "HD" | "SD";

export function qualityBadge(height: number | null | undefined): QualityBadge | null {
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) return null;
  if (height >= 2160) return "4K";
  if (height >= 720) return "HD";
  return "SD";
}
