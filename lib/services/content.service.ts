import { prisma } from '@/lib/prisma';
import { VideoContentService, buildPublicVideoWhere as buildWhere } from './content/video.service';
import { CreatorContentService } from './content/creator.service';

export const buildPublicVideoWhere = buildWhere;
export { VideoContentService, CreatorContentService };

/**
 * @deprecated Use specialized services from @/lib/services/content/
 */
export class ContentService {
  static getVideoById(id: string) { return VideoContentService.getVideoById(id); }
  static getCreatorBySlug(slug: string) { return CreatorContentService.getCreatorBySlug(slug); }
  static getConfiguredOrDefaultCreator() { return CreatorContentService.getConfiguredOrDefaultCreator(); }
  static getAllVideos() { return VideoContentService.getAllVideos(); }
  static getMainFeaturedVideo() { return VideoContentService.getMainFeaturedVideo(); }

  static async getVideoAccess(userId: string | null, videoId: string) {
    return VideoContentService.getVideoAccess(userId, videoId);
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
