import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";
import { isAdultVideo } from "@/lib/modules/video/domain/video-visibility";
import { isUpcomingPremiere, toPremiereDate } from "@/lib/premiere";
import { isPremiumPassVideoForEveryone } from "@/lib/modules/experiment-premium-pass"; // experiment: premium-pass (docs/experiments/premium-pass.md)

/** What the embed surfaces (the embeddable player page and the oEmbed endpoint) may do with a video. */
export type EmbedDecision =
  /** A PUBLIC-tier, published, due video on a publicly visible channel: the player may be framed and oEmbed answers. */
  | "embeddable"
  /** A published video that needs the site (signed-in/paid tier, 18+, premiere not yet due): only a "watch on the site" card. */
  | "site-only"
  /** Not found, not PUBLISHED (UNLISTED, DRAFT, ARCHIVED), removed, or on a hidden channel: nothing is revealed. */
  | "unavailable";

export type EmbedCandidate = {
  status?: string | null;
  /** The RAW stored tier (never `toVideoAccessTier`, which maps unknown values to LOGGED_IN: PAID must stay non-public). */
  tier?: string | null;
  moderationStatus?: string | null;
  isAdult?: boolean | null;
  publishedAt?: Date | string | null;
  premiereAt?: Date | string | null;
  creator?: { status?: string | null; deletedAt?: Date | null } | null;
  /** experiment: premium-pass: a video behind the demo pass for everyone is site-only. */
  slug?: string | null;
  isMainFeatured?: boolean | null;
};

/**
 * The one embed rule. Only `PUBLISHED` videos exist for it (an UNLISTED link must not be advertised by an embed
 * surface, and a draft never exists), and only the `PUBLIC` tier may actually play inside another site. Signed-in
 * and paid videos are announced with a card that sends the viewer to the site; everything the viewer is not
 * allowed to know about looks exactly like a missing video.
 */
export function decideEmbed(video: EmbedCandidate | null | undefined, now: Date = new Date()): EmbedDecision {
  if (!video) return "unavailable";
  if (video.status !== "PUBLISHED") return "unavailable";
  if (video.moderationStatus === "REMOVED") return "unavailable";
  const publishedAt = toPremiereDate(video.publishedAt);
  if (publishedAt && publishedAt.getTime() > now.getTime()) return "unavailable";
  if (!video.creator || !MainChannelPolicy.isPubliclyVisible(video.creator)) return "unavailable";

  if (video.tier !== "PUBLIC") return "site-only";
  if (isAdultVideo(video)) return "site-only";
  if (isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt }, now)) return "site-only";
  if (isPremiumPassVideoForEveryone(video, process.env, now)) return "site-only"; // experiment: premium-pass
  return "embeddable";
}
