import { prisma } from '@/lib/prisma';
import { VideoContentService, buildPublicVideoWhere as buildWhere } from './content/video.service';
import { CreatorContentService } from './content/creator.service';

export const buildPublicVideoWhere = buildWhere;

/**
 * @deprecated Use specialized services from @/lib/services/content/
 */
export class ContentService {
  static getVideoById = VideoContentService.getVideoById.bind(VideoContentService);
  static getCreatorBySlug = CreatorContentService.getCreatorBySlug.bind(CreatorContentService);
  static getConfiguredOrDefaultCreator = CreatorContentService.getConfiguredOrDefaultCreator.bind(CreatorContentService);
  static getAllVideos = VideoContentService.getAllVideos.bind(VideoContentService);
  static getMainFeaturedVideo = VideoContentService.getMainFeaturedVideo.bind(VideoContentService);

  static async getVideoAccess(userId: string | null, videoId: string) {
    const { AccessPolicy } = await import('../access/access-policy');
    const decision = await AccessPolicy.canViewVideo(userId, videoId);
    return {
        hasAccess: decision.allowed,
        reason: decision.reason,
        requiredTier: decision.requiredTier
    };
  }

  static async createComment(data: {
    text: string,
    authorId: string,
    videoId: string,
    parentId?: string,
    creatorId?: string,
    imageUrl?: string
  }) {
    return prisma.comment.create({
        data: {
          text: data.text,
          authorId: data.authorId,
          videoId: data.videoId,
          parentId: data.parentId,
          creatorId: data.creatorId,
          imageUrl: data.imageUrl
        }
    });
  }
}
