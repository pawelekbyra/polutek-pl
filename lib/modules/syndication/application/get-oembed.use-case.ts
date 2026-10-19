import { resolvePublicThumbnailSrc } from "@/lib/modules/media";
import { decideEmbed } from "../domain/embed-eligibility";
import { buildOembedResponse, parseVideoSlugFromUrl, type OembedResponse } from "../domain/oembed";
import { findVideoForEmbed } from "../infrastructure/syndication.repository";

export type OembedResult =
  | { status: "bad_request" }
  | { status: "not_found" }
  | { status: "ok"; body: OembedResponse };

/**
 * oEmbed for a video page of this site. Only a PUBLIC-tier, published, due video of a publicly visible channel is
 * embeddable; every other case (unknown, UNLISTED, draft, signed-in/paid tier, 18+, premiere to come, hidden
 * channel) is the same "not found", so the endpoint reveals nothing about a video that is not public.
 */
export async function getOembed(input: {
  url: string | null;
  baseUrl: string;
  providerName: string;
  maxWidth?: number | null;
  maxHeight?: number | null;
  now?: Date;
}): Promise<OembedResult> {
  if (!input.url) return { status: "bad_request" };
  const slug = parseVideoSlugFromUrl(input.url, input.baseUrl);
  if (!slug) return { status: "not_found" };

  const video = await findVideoForEmbed(slug);
  if (!video || decideEmbed(video, input.now) !== "embeddable") return { status: "not_found" };

  const thumbnail = resolvePublicThumbnailSrc(video, process.env);
  const origin = input.baseUrl.replace(/\/+$/, "");
  return {
    status: "ok",
    body: buildOembedResponse({
      baseUrl: input.baseUrl,
      providerName: input.providerName,
      maxWidth: input.maxWidth,
      maxHeight: input.maxHeight,
      video: {
        slug: video.slug,
        title: video.title,
        thumbnailUrl: /^https?:\/\//i.test(thumbnail) ? thumbnail : `${origin}${thumbnail}`,
        channelName: video.creator.name,
        channelSlug: video.creator.slug,
      },
    }),
  };
}
