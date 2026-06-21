import { VideoPlaybackSession, Prisma } from "@prisma/client";
import { DbClient } from "@/lib/modules/shared/db";

export interface RecordViewResult {
  counted: boolean;
  skippedReason?: 'SESSION_ALREADY_COUNTED';
}

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

  async recordView(videoId: string, sessionId: string, userId: string | null, ipHash: string | null): Promise<RecordViewResult> {
    const claimedSession = await this.db.videoPlaybackSession.updateMany({
      where: {
        id: sessionId,
        countedAsView: false
      },
      data: { countedAsView: true }
    });

    if (claimedSession.count !== 1) {
      return { counted: false, skippedReason: 'SESSION_ALREADY_COUNTED' };
    }

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

    return { counted: true };
  }

  async markSessionAsViewed(sessionId: string): Promise<void> {
    await this.db.videoPlaybackSession.update({
      where: { id: sessionId },
      data: { countedAsView: true }
    });
  }
}
