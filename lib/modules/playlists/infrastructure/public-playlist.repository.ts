import { prisma } from "@/lib/prisma";
import { publiclyVisibleChannelWhere } from "@/lib/modules/channel";
import { resolvePublicThumbnailSrc } from "@/lib/modules/media";
import { toVideoAccessTier } from "@/lib/access-tier";
import { isAdultVideo } from "@/lib/modules/video/domain/video-visibility";
import type { PlaylistVideoCardDto } from "../domain/playlist.dto";
import { isPlaylistItemVisible } from "../domain/playlist-visibility";

/**
 * Public reads of playlists. The playlist and its channel are filtered in the query (not deleted, PUBLIC or UNLISTED,
 * publicly visible channel); the domain's `isPlaylistItemVisible` has the last word on every item.
 */

const publicVideoSelect = {
  id: true,
  creatorId: true,
  slug: true,
  title: true,
  titleEn: true,
  thumbnailUrl: true,
  thumbnailPublicUrl: true,
  duration: true,
  tier: true,
  status: true,
  moderationStatus: true,
  isAdult: true,
  views: true,
  publishedAt: true,
  premiereAt: true,
} as const;

const channelSelect = { id: true, name: true, slug: true, handle: true, status: true, deletedAt: true } as const;

type PublicVideoRow = {
  id: string;
  creatorId: string;
  slug: string;
  title: string;
  titleEn: string | null;
  thumbnailUrl: string | null;
  thumbnailPublicUrl: string | null;
  duration: string | null;
  tier: string;
  status: string;
  moderationStatus: string | null;
  isAdult: boolean;
  views: number;
  publishedAt: Date | null;
  premiereAt: Date | null;
};

export function toPlaylistVideoCard(video: PublicVideoRow): PlaylistVideoCardDto {
  return {
    id: video.id,
    slug: video.slug,
    title: video.title,
    titleEn: video.titleEn,
    thumbnailUrl: resolvePublicThumbnailSrc(video, process.env),
    duration: video.duration,
    tier: toVideoAccessTier(video.tier),
    isAdult: isAdultVideo(video),
    views: video.views,
    publishedAt: video.publishedAt ? video.publishedAt.toISOString() : null,
  };
}

/** A publicly visible channel by its stable slug or its current @handle. */
export function findPublicChannel(key: string) {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > 100) return Promise.resolve(null);
  return prisma.creator.findFirst({
    where: { ...publiclyVisibleChannelWhere(), OR: [{ slug: trimmed }, { handle: { equals: trimmed, mode: "insensitive" } }] },
    select: channelSelect,
  });
}

/** Visible items of one playlist, in order (the 200-item cap of a playlist bounds the read). */
async function loadVisibleItems(playlistId: string, channelId: string, signedIn: boolean, now: Date) {
  const rows = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: [{ position: "asc" }, { addedAt: "asc" }],
    select: { video: { select: publicVideoSelect } },
  });
  return rows
    .map((r) => r.video)
    .filter((video) => isPlaylistItemVisible(video, { channelId, signedIn, now }))
    .map(toPlaylistVideoCard);
}

export async function loadPublicPlaylist(channelKey: string, playlistSlug: string, signedIn: boolean, now: Date) {
  const channel = await findPublicChannel(channelKey);
  if (!channel) return null;
  const playlist = await prisma.playlist.findFirst({
    where: { channelId: channel.id, slug: playlistSlug, deletedAt: null, visibility: { in: ["PUBLIC", "UNLISTED"] } },
    select: { id: true, slug: true, title: true, description: true, visibility: true },
  });
  if (!playlist) return null;
  const items = await loadVisibleItems(playlist.id, channel.id, signedIn, now);
  return { channel, playlist, items };
}

export async function loadPublicPlaylistSummaries(channelId: string, signedIn: boolean, now: Date) {
  const playlists = await prisma.playlist.findMany({
    where: { channelId, deletedAt: null, visibility: "PUBLIC" },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      items: { orderBy: [{ position: "asc" }, { addedAt: "asc" }], select: { video: { select: publicVideoSelect } } },
    },
  });
  return playlists.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    visible: p.items
      .map((i) => i.video)
      .filter((video) => isPlaylistItemVisible(video, { channelId, signedIn, now }))
      .map(toPlaylistVideoCard),
  }));
}

/** The channel of a video, for resolving `?list=` on the watch page (the playlist must be of that video's channel). */
export async function loadVideoChannel(videoId: string) {
  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { creator: { select: channelSelect } } });
  return video?.creator ?? null;
}

export async function loadQueue(channelId: string, listSlug: string, signedIn: boolean, now: Date) {
  const playlist = await prisma.playlist.findFirst({
    where: { channelId, slug: listSlug, deletedAt: null, visibility: { in: ["PUBLIC", "UNLISTED"] } },
    select: { id: true, slug: true, title: true },
  });
  if (!playlist) return null;
  return { playlist, items: await loadVisibleItems(playlist.id, channelId, signedIn, now) };
}
