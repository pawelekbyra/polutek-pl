import { prisma } from '@/lib/prisma';
import { AccessTier } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';

const ADMIN_EMAIL = "pawel.perfect@gmail.com";

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
                select: { imageUrl: true, email: true }
              }
            }
          }
        }
      });

      if (!video) {
        return INITIAL_VIDEOS.find(v => v.id === videoId) || null;
      }

      return video;
    } catch (e: any) {
      console.error("[GET_VIDEO_BY_ID_ERROR]", e);
      return INITIAL_VIDEOS.find(v => v.id === videoId) || null;
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

      if (!creator && slug === 'polutek') {
        return {
            ...DEFAULT_CREATOR,
            imageUrl: adminData?.imageUrl || null,
            user: adminData,
            videos: INITIAL_VIDEOS
        };
      }

      return creator;
    } catch (e: any) {
      console.error("[GET_CREATOR_BY_SLUG_ERROR]", e);
      if (slug === 'polutek') {
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
    try {
      const video = await this.getVideoById(videoId);

      if (!video) {
        return { hasAccess: false, userTotalPaid: 0, requiredTier: AccessTier.PUBLIC, videoUrl: null };
      }

      const videoUrl = video.videoUrl;

      if (video.isMainFeatured) {
        return { hasAccess: true, userTotalPaid: 0, requiredTier: AccessTier.PUBLIC, videoUrl };
      }

      if (video.tier === AccessTier.PUBLIC) {
        return { hasAccess: true, userTotalPaid: 0, requiredTier: video.tier, videoUrl };
      }

      if (!userId) {
        return { hasAccess: false, userTotalPaid: 0, requiredTier: video.tier, videoUrl: null };
      }

      if (video.tier === AccessTier.LOGGED_IN) {
        return { hasAccess: true, userTotalPaid: 0, requiredTier: video.tier, videoUrl };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { totalPaid: true, referralCount: true, role: true, email: true }
      });

      if (!user) {
        return { hasAccess: false, userTotalPaid: 0, requiredTier: video.tier };
      }

      if (user.role === 'ADMIN' || user.email === ADMIN_EMAIL) {
        return { hasAccess: true, userTotalPaid: user.totalPaid, requiredTier: video.tier, videoUrl };
      }

      if (video.tier === AccessTier.VIP1) {
        const hasAccess = user.totalPaid >= 5 || user.referralCount >= 5;
        return { hasAccess, userTotalPaid: user.totalPaid, referralCount: user.referralCount, requiredTier: video.tier, videoUrl: hasAccess ? videoUrl : null };
      }

      if (video.tier === AccessTier.VIP2) {
        const hasAccess = user.totalPaid >= 10 || user.referralCount >= 5;
        return { hasAccess, userTotalPaid: user.totalPaid, referralCount: user.referralCount, requiredTier: video.tier, videoUrl: hasAccess ? videoUrl : null };
      }

      return { hasAccess: false, userTotalPaid: user.totalPaid, requiredTier: video.tier, videoUrl: null };
    } catch (error: any) {
      console.error("[GET_VIDEO_ACCESS_ERROR]", error);
      // Fallback check against initial data for public access
      const v = INITIAL_VIDEOS.find(vid => vid.id === videoId);
      const isPublic = v?.tier === AccessTier.PUBLIC || v?.isMainFeatured;
      return {
        hasAccess: !!isPublic,
        userTotalPaid: 0,
        requiredTier: v?.tier || AccessTier.PUBLIC,
        videoUrl: isPublic ? v?.videoUrl : null
      };
    }
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
    } catch (e: any) {
      console.error("[CREATE_COMMENT_ERROR]", e);
      throw new Error(`Failed to create comment: ${e.message}`);
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

      if (videos.length === 0) return INITIAL_VIDEOS;
      return videos;
    } catch (e: any) {
      console.error("[GET_ALL_VIDEOS_ERROR]", e);
      return INITIAL_VIDEOS;
    }
  }

  /**
   * Fetches the main featured video from the database, falling back to initial content.
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

      if (!video) return INITIAL_VIDEOS[0];
      return video;
    } catch (e: any) {
      console.error("[GET_MAIN_FEATURED_VIDEO_ERROR]", e);
      return INITIAL_VIDEOS[0];
    }
  }
}
