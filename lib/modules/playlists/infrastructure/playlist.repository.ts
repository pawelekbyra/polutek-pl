import type { Prisma } from "@prisma/client";
import type { DbClient } from "@/lib/modules/shared/db";
import type { PlaylistVisibilityValue } from "../domain/playlist-rules";

/** Writes and Studio reads of playlists. Every lookup is scoped by channel: an id from another channel is "not found". */
const playlistColumns = {
  id: true,
  channelId: true,
  title: true,
  description: true,
  visibility: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PlaylistRow = Prisma.PlaylistGetPayload<{ select: typeof playlistColumns }>;

export const studioItemVideoSelect = {
  id: true,
  creatorId: true,
  slug: true,
  title: true,
  status: true,
  moderationStatus: true,
  isAdult: true,
  publishedAt: true,
  premiereAt: true,
  thumbnailUrl: true,
  thumbnailPublicUrl: true,
} as const;

export class PlaylistRepository {
  constructor(private readonly db: DbClient) {}

  /** Serializes writers of one playlist (add, remove, reorder) inside the surrounding transaction. */
  async lock(playlistId: string): Promise<void> {
    await this.db.$queryRaw`SELECT "id" FROM "Playlist" WHERE "id" = ${playlistId} FOR UPDATE`;
  }

  findInChannel(playlistId: string, channelId: string): Promise<PlaylistRow | null> {
    return this.db.playlist.findFirst({ where: { id: playlistId, channelId, deletedAt: null }, select: playlistColumns });
  }

  countActive(channelId: string): Promise<number> {
    return this.db.playlist.count({ where: { channelId, deletedAt: null } });
  }

  /** Slugs taken in the channel that start with `base`, soft-deleted playlists included (their links stay reserved). */
  async takenSlugs(channelId: string, base: string): Promise<Set<string>> {
    const rows = await this.db.playlist.findMany({ where: { channelId, slug: { startsWith: base } }, select: { slug: true } });
    return new Set(rows.map((r) => r.slug));
  }

  create(data: { channelId: string; title: string; description: string | null; visibility: PlaylistVisibilityValue; slug: string }): Promise<PlaylistRow> {
    return this.db.playlist.create({ data, select: playlistColumns });
  }

  update(id: string, data: { title?: string; description?: string | null; visibility?: PlaylistVisibilityValue }): Promise<PlaylistRow> {
    return this.db.playlist.update({ where: { id }, data, select: playlistColumns });
  }

  async softDelete(id: string, now: Date): Promise<void> {
    await this.db.playlist.update({ where: { id }, data: { deletedAt: now } });
  }

  listForChannel(channelId: string) {
    return this.db.playlist.findMany({
      where: { channelId, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }],
      select: { ...playlistColumns, _count: { select: { items: true } } },
    });
  }

  itemsWithVideos(playlistId: string) {
    return this.db.playlistItem.findMany({
      where: { playlistId },
      orderBy: [{ position: "asc" }, { addedAt: "asc" }],
      select: { videoId: true, position: true, video: { select: studioItemVideoSelect } },
    });
  }

  async orderedVideoIds(playlistId: string): Promise<string[]> {
    const rows = await this.db.playlistItem.findMany({
      where: { playlistId },
      orderBy: [{ position: "asc" }, { addedAt: "asc" }],
      select: { videoId: true },
    });
    return rows.map((r) => r.videoId);
  }

  async nextPosition(playlistId: string): Promise<number> {
    const last = await this.db.playlistItem.aggregate({ where: { playlistId }, _max: { position: true } });
    return (last._max.position ?? -1) + 1;
  }

  countItems(playlistId: string): Promise<number> {
    return this.db.playlistItem.count({ where: { playlistId } });
  }

  findChannelVideo(videoId: string, channelId: string) {
    return this.db.video.findFirst({ where: { id: videoId, creatorId: channelId }, select: { id: true } });
  }

  async hasItem(playlistId: string, videoId: string): Promise<boolean> {
    const row = await this.db.playlistItem.findUnique({ where: { playlistId_videoId: { playlistId, videoId } }, select: { id: true } });
    return row !== null;
  }

  async addItem(playlistId: string, videoId: string, position: number): Promise<void> {
    await this.db.playlistItem.create({ data: { playlistId, videoId, position } });
  }

  async removeItem(playlistId: string, videoId: string): Promise<number> {
    const result = await this.db.playlistItem.deleteMany({ where: { playlistId, videoId } });
    return result.count;
  }

  async setPosition(playlistId: string, videoId: string, position: number): Promise<void> {
    await this.db.playlistItem.update({ where: { playlistId_videoId: { playlistId, videoId } }, data: { position } });
  }

  async touch(id: string): Promise<void> {
    await this.db.playlist.update({ where: { id }, data: { updatedAt: new Date() } });
  }
}
