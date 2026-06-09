import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { VideoLike, VideoDislike, CommentReaction, CommentReactionType } from "@prisma/client";

export class CommentRepository {
  constructor(private db: ReadDb) {}

  async findVideoLike(userId: string, videoId: string): Promise<VideoLike | null> {
    return await this.db.videoLike.findUnique({
      where: { userId_videoId: { userId, videoId } }
    });
  }

  async findVideoDislike(userId: string, videoId: string): Promise<VideoDislike | null> {
    return await this.db.videoDislike.findUnique({
      where: { userId_videoId: { userId, videoId } }
    });
  }

  async createVideoLike(userId: string, videoId: string): Promise<VideoLike> {
    const like = await (this.db as WriteTx).videoLike.create({
      data: { userId, videoId }
    });
    await (this.db as WriteTx).video.update({
      where: { id: videoId },
      data: { likesCount: { increment: 1 } }
    });
    return like;
  }

  async deleteVideoLike(id: string, videoId: string): Promise<void> {
    await (this.db as WriteTx).videoLike.delete({ where: { id } });
    await (this.db as WriteTx).video.updateMany({
      where: { id: videoId, likesCount: { gt: 0 } },
      data: { likesCount: { decrement: 1 } }
    });
  }

  async createVideoDislike(userId: string, videoId: string): Promise<VideoDislike> {
    const dislike = await (this.db as WriteTx).videoDislike.create({
      data: { userId, videoId }
    });
    await (this.db as WriteTx).video.update({
      where: { id: videoId },
      data: { dislikesCount: { increment: 1 } }
    });
    return dislike;
  }

  async deleteVideoDislike(id: string, videoId: string): Promise<void> {
    await (this.db as WriteTx).videoDislike.delete({ where: { id } });
    await (this.db as WriteTx).video.updateMany({
      where: { id: videoId, dislikesCount: { gt: 0 } },
      data: { dislikesCount: { decrement: 1 } }
    });
  }

  async findCommentById(id: string) {
    return await this.db.comment.findUnique({
      where: { id },
      select: { id: true, videoId: true, authorId: true }
    });
  }

  async findCommentReaction(userId: string, commentId: string): Promise<CommentReaction | null> {
    return await this.db.commentReaction.findUnique({
      where: { userId_commentId: { userId, commentId } }
    });
  }

  async createCommentLike(userId: string, commentId: string): Promise<CommentReaction> {
    const reaction = await (this.db as WriteTx).commentReaction.create({
      data: { userId, commentId, type: CommentReactionType.LIKE }
    });
    await (this.db as WriteTx).comment.update({
      where: { id: commentId },
      data: {
        likesCount: { increment: 1 },
        score: { increment: 1 }
      }
    });
    return reaction;
  }

  async deleteCommentReaction(id: string, commentId: string): Promise<void> {
    await (this.db as WriteTx).commentReaction.delete({ where: { id } });
    await (this.db as WriteTx).comment.update({
      where: { id: commentId },
      data: {
        likesCount: { decrement: 1 },
        score: { decrement: 1 }
      }
    });

    // Double check to avoid underflow
    await (this.db as WriteTx).comment.updateMany({
      where: { id: commentId, likesCount: { lt: 0 } },
      data: { likesCount: 0, score: 0 }
    });
  }
}
