import { Prisma, AccessTier, VideoStatus } from "@prisma/client";

export class VideoPolicy {
  static canBeHero(video: { tier: AccessTier; status: VideoStatus }): boolean {
    return video.tier === 'PUBLIC' && video.status === 'PUBLISHED';
  }

  static isOnMainChannel(video: { creatorId: string }, mainChannelId: string): boolean {
    return video.creatorId === mainChannelId;
  }

  static isPubliclyVisible(video: { status: VideoStatus; publishedAt: Date | null }, now: Date): boolean {
    if (video.status !== 'PUBLISHED') return false;
    if (!video.publishedAt) return false;
    return video.publishedAt <= now;
  }

  static buildPublicWhere(mainChannelId: string, now: Date): Prisma.VideoWhereInput {
    return {
      creatorId: mainChannelId,
      status: 'PUBLISHED',
      publishedAt: { lte: now }
    };
  }

  static buildAdminWhere(mainChannelId: string, filters:
any): Prisma.VideoWhereInput {
    const where: Prisma.VideoWhereInput = { creatorId: mainChannelId };

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status as VideoStatus;
    }
    if (filters.tier && filters.tier !== 'ALL') {
      where.tier = filters.tier as AccessTier;
    }
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { slug: { contains: filters.query, mode: 'insensitive' } }
      ];
    }
    if (filters.isMainFeatured === 'true') where.isMainFeatured = true;
    if (filters.isMainFeatured === 'false') where.isMainFeatured = false;

    if (filters.showInSidebar === 'true') where.showInSidebar = true;
    if (filters.showInSidebar === 'false') where.showInSidebar = false;

    return where;
  }
}
