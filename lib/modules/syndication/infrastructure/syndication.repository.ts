import { prisma } from "@/lib/prisma";
import { publiclyVisibleChannelWhere } from "@/lib/modules/channel";
import { resolvePublicThumbnailSrc } from "@/lib/modules/media";
import { FEED_ITEM_LIMIT, type FeedChannel, type FeedVideoRow } from "../domain/rss";

function absoluteUrl(baseUrl: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl.replace(/\/+$/, "")}${value.startsWith("/") ? "" : "/"}${value}`;
}

/**
 * A publicly visible channel (ACTIVE or LIMITED, not deleted) by its stable slug or its current @handle, with the
 * newest candidates for its feed. The domain's `selectFeedVideos` has the last word on eligibility; the query only
 * narrows the rows (published, due, not removed, not 18+). Null for an unknown or hidden channel.
 */
export async function loadChannelFeedSource(
  key: string,
  baseUrl: string,
  now: Date,
): Promise<{ channel: FeedChannel; rows: FeedVideoRow[] } | null> {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > 100) return null;
  const channel = await prisma.creator.findFirst({
    where: { ...publiclyVisibleChannelWhere(), OR: [{ slug: trimmed }, { handle: { equals: trimmed, mode: "insensitive" } }] },
    select: { id: true, name: true, slug: true, bio: true },
  });
  if (!channel) return null;

  const videos = await prisma.video.findMany({
    where: {
      creatorId: channel.id,
      status: "PUBLISHED",
      moderationStatus: { notIn: ["REMOVED", "AGE_RESTRICTED"] },
      isAdult: false,
      AND: [
        { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
        { OR: [{ premiereAt: null }, { premiereAt: { lte: now } }] },
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: FEED_ITEM_LIMIT * 2,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      tier: true,
      status: true,
      moderationStatus: true,
      isAdult: true,
      publishedAt: true,
      premiereAt: true,
      createdAt: true,
      thumbnailUrl: true,
      thumbnailPublicUrl: true,
    },
  });

  return {
    channel: { name: channel.name, slug: channel.slug, bio: channel.bio },
    rows: videos.map((video) => ({
      id: video.id,
      slug: video.slug,
      title: video.title,
      description: video.description,
      tier: video.tier,
      status: video.status,
      moderationStatus: video.moderationStatus,
      isAdult: video.isAdult,
      publishedAt: video.publishedAt,
      premiereAt: video.premiereAt,
      createdAt: video.createdAt,
      thumbnailUrl: absoluteUrl(baseUrl, resolvePublicThumbnailSrc(video, process.env)),
    })),
  };
}

/** A video by slug (or id) with its channel, for the embed surfaces. The caller decides what may be shown (`decideEmbed`). */
export async function findVideoForEmbed(key: string) {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > 200) return null;
  return prisma.video.findFirst({
    where: { OR: [{ slug: trimmed }, { id: trimmed }] },
    include: { creator: true },
  });
}
