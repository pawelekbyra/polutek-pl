import { prisma } from '@/lib/prisma';
import { AccessTier } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { ADMIN_EMAIL } from '../constants';

function allowDemoFallbacks() {
  return process.env.ENABLE_DEMO_FALLBACKS === 'true' || process.env.NODE_ENV !== 'production';
}

export class ContentService {
  /**
   * Retrieves a single video by ID, including creator information.
   * Falls back to initial data if not found in DB.
   */
  static async getVideoById(videoId: string) {
    try {
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        include: {
          creator: {
            include: {
              user: {
                select: { imageUrl: true, email: true, name: true, username: true }
              }
            }
          }
        }
      });

      if (!video) {
        return allowDemoFallbacks() ? INITIAL_VIDEOS.find(v => v.id === videoId) || null : null;
      }

      return video;
    } catch (e: unknown) {
      console.error("[GET_VIDEO_BY_ID_ERROR]", e);
      return allowDemoFallbacks() ? INITIAL_VIDEOS.find(v => v.id === videoId) || null : null;
    }
  }

  /**
   * Robustly fetches admin data from the database, prioritizing users with avatars.
   */
  static async getAdminData() {
    try {
      // Step 1: Try to find the specific admin user by email (most reliable)
      let adminUser = await prisma.user.findFirst({
        where: {
          email: { equals: ADMIN_EMAIL, mode: 'insensitive' }
        },
        orderBy: [
            { imageUrl: 'desc' }, // Not null first
            { updatedAt: 'desc' }
        ],
        select: { imageUrl: true, email: true }
      });

      // Step 2: Try to find any other admin user if first lookup failed
      if (!adminUser) {
        adminUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          orderBy: [
              { imageUrl: 'desc' },
              { updatedAt: 'desc' }
          ],
          select: { imageUrl: true, email: true }
        });
      }

      return adminUser || { imageUrl: null, email: ADMIN_EMAIL };
    } catch {
      return { imageUrl: null, email: ADMIN_EMAIL };
    }
  }

  /**
   * Retrieves a creator by their unique slug.
   * Falls back to default creator for 'polutek' if not found.
   */
  static async getCreatorBySlug(slug: string) {
    try {
      const creator = await prisma.creator.findUnique({
        where: { slug },
        include: {
          user: {
            select: { imageUrl: true, email: true }
          },
          videos: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      const adminData = slug === 'polutek' ? await this.getAdminData() : null;

      if (slug === 'polutek' && creator) {
        creator.name = 'POLUTEK.PL';
        // Force sync user data if available from admin lookup
        if (adminData) {
            if (!creator.user) (creator as any).user = adminData;
            else {
                // Prioritize fresh data from admin lookup
                if (adminData.imageUrl) (creator as any).user.imageUrl = adminData.imageUrl;
                if (adminData.email) (creator as any).user.email = adminData.email;
            }
            // Explicitly set creator image from user image
            if (creator.user?.imageUrl) (creator as any).imageUrl = creator.user.imageUrl;
        }
      }

      if (!creator && slug === 'polutek' && allowDemoFallbacks()) {
        return {
            ...DEFAULT_CREATOR,
            imageUrl: adminData?.imageUrl || null,
            user: adminData,
            videos: INITIAL_VIDEOS
        };
      }

      return creator;
    } catch (e: unknown) {
      console.error("[GET_CREATOR_BY_SLUG_ERROR]", e);
      if (slug === 'polutek' && allowDemoFallbacks()) {
        return {
            ...DEFAULT_CREATOR,
            videos: INITIAL_VIDEOS
        };
      }
      return null;
    }
  }

  /**
   * Evaluates if a user has access to a specific video.
   */
  static async getVideoAccess(userId: string | null, videoId: string) {
    const { AccessPolicy } = await import('../access/access-policy');
    const decision = await AccessPolicy.canViewVideo(userId, videoId);
    return {
        hasAccess: decision.allowed,
        reason: decision.reason,
        requiredTier: decision.requiredTier
    };
  }

  /**
   * Standardized method for creating comments.
   */
  static async createComment(data: {
    text: string,
    authorId: string,
    videoId: string,
    parentId?: string,
    creatorId?: string,
    imageUrl?: string
  }) {
    try {
      return await prisma.comment.create({
        data: {
          text: data.text,
          authorId: data.authorId,
          videoId: data.videoId,
          parentId: data.parentId,
          creatorId: data.creatorId,
          imageUrl: data.imageUrl
        }
      });
    } catch (e: unknown) {
      console.error("[CREATE_COMMENT_ERROR]", e);
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to create comment: ${message}`);
    }
  }

  /**
   * Fetches all videos from the database, falling back to initial content.
   */
  static async getAllVideos() {
    try {
      const videos = await prisma.video.findMany({
        include: {
          creator: {
            include: {
              user: {
                select: { imageUrl: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (videos.length === 0 && allowDemoFallbacks()) return INITIAL_VIDEOS;
      return videos;
    } catch (e: unknown) {
      console.error("[GET_ALL_VIDEOS_ERROR]", e);
      if (allowDemoFallbacks()) return INITIAL_VIDEOS;
      throw new Error('CONTENT_UNAVAILABLE');
    }
  }

  /**
   * Fetches the main featured video from the database.
   */
  static async getMainFeaturedVideo() {
    try {
      const video = await prisma.video.findFirst({
        where: { isMainFeatured: true },
        include: {
          creator: {
            include: {
              user: {
                select: { imageUrl: true, email: true }
              }
            }
          }
        }
      });

      if (!video && allowDemoFallbacks()) return INITIAL_VIDEOS[0];
      return video;
    } catch (e: unknown) {
      console.error("[GET_MAIN_FEATURED_VIDEO_ERROR]", e);
      if (allowDemoFallbacks()) return INITIAL_VIDEOS[0];
      throw new Error('CONTENT_UNAVAILABLE');
    }
  }
}
