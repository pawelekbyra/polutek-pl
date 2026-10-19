import type { PublicVideoDTO } from "@/app/types/video";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";
import { decideEmbed } from "../domain/embed-eligibility";
import { findVideoForEmbed } from "../infrastructure/syndication.repository";

export type EmbedView =
  /** Mount the player: PUBLIC tier, published, due. The DTO is the same whitelisted one the site uses. */
  | { kind: "embeddable"; video: PublicVideoDTO }
  /** Published but needs the site: show the title and a "watch on the site" link, never a player. */
  | { kind: "site-only"; slug: string; title: string }
  /** Anything else looks the same as a missing video. */
  | { kind: "unavailable" };

/** What `/embed/<slug>` renders. Public read; the viewer's session is never consulted. */
export async function getEmbedView(key: string, now: Date = new Date()): Promise<EmbedView> {
  const video = await findVideoForEmbed(key);
  const decision = decideEmbed(video, now);
  if (!video || decision === "unavailable") return { kind: "unavailable" };
  if (decision === "site-only") return { kind: "site-only", slug: video.slug, title: video.title };
  return { kind: "embeddable", video: VideoContentService.mapToPublicVideoDTO(video) };
}
