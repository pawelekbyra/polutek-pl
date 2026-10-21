import type { DbClient } from "@/lib/modules/shared/db";
import { favoritableVideoWhere, FAVORITES_LIST_LIMIT } from "../domain/favorite-rules";

/** Storage of the viewer's own favorites. Every query is scoped by `userId`: one viewer never reads or changes another's. */
export class FavoriteRepository {
  constructor(private readonly db: DbClient) {}

  async has(userId: string, videoId: string): Promise<boolean> {
    const row = await this.db.videoFavorite.findUnique({
      where: { userId_videoId: { userId, videoId } },
      select: { id: true },
    });
    return row !== null;
  }

  /** Whether the video exists and may be saved (see `favoritableVideoWhere`). */
  async isFavoritable(videoId: string): Promise<boolean> {
    const video = await this.db.video.findFirst({ where: { id: videoId, ...favoritableVideoWhere() }, select: { id: true } });
    return video !== null;
  }

  /** Idempotent: saving an already saved video changes nothing (the unique key makes a race harmless). */
  async add(userId: string, videoId: string): Promise<void> {
    await this.db.videoFavorite.upsert({
      where: { userId_videoId: { userId, videoId } },
      create: { userId, videoId },
      update: {},
    });
  }

  /** Idempotent: removing a video that is not saved changes nothing. */
  async remove(userId: string, videoId: string): Promise<void> {
    await this.db.videoFavorite.deleteMany({ where: { userId, videoId } });
  }

  /** The viewer's saved videos that are still favoritable, newest saved first. */
  async listVideos(userId: string, limit: number = FAVORITES_LIST_LIMIT) {
    return this.db.videoFavorite.findMany({
      where: { userId, video: favoritableVideoWhere() },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        video: {
          select: {
            id: true,
            slug: true,
            title: true,
            titleEn: true,
            status: true,
            thumbnailUrl: true,
            thumbnailPublicUrl: true,
            creator: { select: { name: true } },
          },
        },
      },
    });
  }
}
