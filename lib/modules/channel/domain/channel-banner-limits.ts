/**
 * Channel banner constants and pure helpers with no imports, safe for browser bundles (Studio UI) and the server.
 *
 * Stored like the avatar: the browser crops the chosen picture to a fixed 4:1 and resizes it, the server
 * validates type, size and file signature and keeps the bytes in `ChannelBanner`. The public address is
 * `/api/channel-banners/<channelId>?v=<timestamp>`; the version changes with every upload so the response is
 * cacheable for a year.
 */
export const BANNER_ASPECT_WIDTH = 4;
export const BANNER_ASPECT_HEIGHT = 1;
/** The browser resizes to this size (4:1). */
export const BANNER_WIDTH_PX = 1280;
export const BANNER_HEIGHT_PX = 320;
/** Largest file a creator may pick (before the browser resizes it). */
export const BANNER_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const BANNER_ACCEPT = "image/jpeg,image/png,image/webp";
/** Upper bound of the uploaded data URL (a resized 1280x320 JPEG is normally 30-120 KB). */
export const BANNER_MAX_DATA_URL_CHARS = 400_000;

const ALLOWED_TYPES = new Set(BANNER_ACCEPT.split(","));

export type BannerProblem = "type" | "size";

export function validateBannerFile(file: { type: string; size: number }): BannerProblem | null {
  if (!ALLOWED_TYPES.has(file.type)) return "type";
  if (file.size > BANNER_MAX_FILE_BYTES) return "size";
  return null;
}

/** Public address of a stored banner; the version is the time of the last change. */
export function bannerRouteUrl(channelId: string, updatedAt: Date | string | number): string {
  const version = new Date(updatedAt).getTime();
  return `/api/channel-banners/${encodeURIComponent(channelId)}?v=${Number.isFinite(version) ? version : 0}`;
}

/** Banner address for a channel row, or null when the channel has none. */
export function resolveChannelBannerUrl(channel: { id: string; bannerUpdatedAt?: Date | string | null }): string | null {
  return channel.bannerUpdatedAt ? bannerRouteUrl(channel.id, channel.bannerUpdatedAt) : null;
}
