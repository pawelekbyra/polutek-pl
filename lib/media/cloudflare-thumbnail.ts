export const THUMBNAIL_SOURCE_MODES = [
  "DEFAULT",
  "CUSTOM",
  "CLOUDFLARE_FIRST_FRAME",
] as const;

export type ThumbnailSourceMode = (typeof THUMBNAIL_SOURCE_MODES)[number];

export const DEFAULT_VIDEO_THUMBNAIL_URL = "/logo.png";

export function normalizeThumbnailSourceMode(value: unknown): ThumbnailSourceMode {
  return value === "CUSTOM" || value === "CLOUDFLARE_FIRST_FRAME" ? value : "DEFAULT";
}

export function isCloudflareFirstFrameThumbnailUrl(value: string | null | undefined): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isCloudflareStreamHost =
      hostname === "videodelivery.net" ||
      hostname.endsWith(".videodelivery.net") ||
      hostname.endsWith(".cloudflarestream.com");

    return isCloudflareStreamHost && url.pathname.toLowerCase().endsWith("/thumbnails/thumbnail.jpg");
  } catch {
    return false;
  }
}

export function buildCloudflareFirstFrameThumbnailUrl(providerAssetId: string): string {
  const uid = providerAssetId.trim();
  if (!uid) return DEFAULT_VIDEO_THUMBNAIL_URL;

  return `https://videodelivery.net/${encodeURIComponent(uid)}/thumbnails/thumbnail.jpg?time=0s`;
}
