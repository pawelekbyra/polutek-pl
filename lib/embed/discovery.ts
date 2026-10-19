import { isAdultVideo } from "@/lib/modules/video/domain/video-visibility";
import { isUpcomingPremiere } from "@/lib/premiere";

/** The discovery link of a video page: `<link rel="alternate" type="application/json+oembed" href=...>`. */
export function buildOembedDiscoveryUrl(baseUrl: string, pageUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/oembed?url=${encodeURIComponent(pageUrl)}&format=json`;
}

/**
 * Whether a public video page should advertise oEmbed: the public DTO says PUBLIC tier (the DTO maps every other tier to
 * LOGGED_IN), published, not 18+, not an upcoming premiere. A hint only: the endpoint itself decides again (`decideEmbed`).
 */
export function isOembedDiscoverable(video: {
  tier?: string | null;
  status?: string | null;
  isAdult?: boolean | null;
  premiereAt?: Date | string | null;
}): boolean {
  if (video.tier !== "PUBLIC" || video.status !== "PUBLISHED") return false;
  if (isAdultVideo(video)) return false;
  return !isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt });
}
