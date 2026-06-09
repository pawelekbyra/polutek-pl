/**
 * InternalMediaSource contains raw/private source information.
 * MUST stay server-side, never returned from public API.
 */
export type InternalMediaSource = {
  videoId: string;
  sourceUrl: string;
  provider?: "s3" | "blob" | "r2" | "external" | "local" | "unknown";
};

/**
 * PublicMediaDescriptor is safe for frontend consumption.
 * It must NEVER contain raw videoUrl or provider secrets.
 */
export type PublicMediaDescriptor = {
  videoId: string;
  playbackUrl: string;
  posterUrl?: string | null;
  duration?: number | null;
};

/**
 * GatedMediaReference represents a media resource that requires
 * an authorized access check before playback.
 */
export type GatedMediaReference = {
  videoId: string;
  endpoint: string;
  requiresAccessCheck: true;
};
