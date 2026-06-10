import { VideoPlaybackSession, Prisma } from "@prisma/client";
import { DbClient, WriteTx } from "@/lib/modules/shared/db";

export class VideoPlaybackRepository {
  constructor(private db: DbClient) {}

  async findSessionById(id: string): Promise<VideoPlaybackSession | null> {
    return await this.db.videoPlaybackSession.findUnique({
      where: { id }
    });
  }

  async updateSession(id: string, data: Prisma.VideoPlaybackSessionUpdateInput): Promise<void> {
    await this.db.videoPlaybackSession.update({
      where: { id },
      data
    });
  }

  async createEvent(data: Prisma.VideoPlaybackEventCreateInput): Promise<void> {
    await this.db.videoPlaybackEvent.create({
      data
    });
  }

  async recordView(videoId: string, sessionId: string, userId: string | null, ipHash: string | null): Promise<void> {
    // This is intended to be called within a transaction if possible,
    // but the repository just uses the provided db client.
    await this.db.videoView.create({
      data: {
        videoId,
        userId: userId || null,
        ipHash: userId ? null : ipHash
      }
    });

    await this.db.video.update({
      where: { id: videoId },
      data: { views: { increment: 1 } }
    });

    await this.db.videoPlaybackSession.update({
      where: { id: sessionId },
      data: { countedAsView: true }
    });
  }

  async markSessionAsViewed(sessionId: string): Promise<void> {
    await this.db.videoPlaybackSession.update({
      where: { id: sessionId },
      data: { countedAsView: true }
    });
  }
}
