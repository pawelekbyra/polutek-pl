import { prisma } from '@/lib/prisma';
import { AccessTier, Creator, Video, VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { ADMIN_EMAIL } from '../constants';
import { PublicVideoDTO, PublicCreatorDTO, PublicCreatorPageDTO } from '@/app/types/video';

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
   * Maps a database creator to a PublicCreatorDTO.
   */
  private static mapToPublicCreatorDTO(creator: any): PublicCreatorDTO {
    return {
        id: creator.id,
        name: creator.name,
        slug: creator.slug,
        imageUrl: creator.imageUrl || creator.user?.imageUrl || null,
        subscribersCount: creator.subscribersCount || 0,
    };
  }

  /**
   * Maps a database video to a PublicVideoDTO.
   */
  private static mapToPublicVideoDTO(video: any): PublicVideoDTO {
    return {
        id: video.id,
        creatorId: video.creatorId,
        title: video.title,
        slug: video.slug,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        tier: video.tier,
        views: video.views,
        likesCount: video.likesCount,
        dislikesCount: video.dislikesCount,
        isMainFeatured: video.isMainFeatured,
        publishedAt: video.publishedAt,
        creator: video.creator ? this.mapToPublicCreatorDTO(video.creator) : undefined,
    };
  }

  /**
   * Retrieves a creator by their unique slug.
   * Falls back to default creator for 'polutek' if not found.
   */
  static async getCreatorBySlug(slug: string): Promise<PublicCreatorPageDTO | null> {
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
        // Map data strictly to prevent leakage
        const videos = (creator.videos || []).map((v: any) => this.mapToPublicVideoDTO({ ...v, creator }));

        return {
            id: creator.id,
            name: 'POLUTEK.PL',
            slug: creator.slug,
            imageUrl: adminData?.imageUrl || creator.user?.imageUrl || null,
            bannerUrl: creator.bannerUrl,
            bio: creator.bio,
            userId: creator.userId,
            subscribersCount: creator.subscribersCount || 0,
            videos
        };
      }

      if (!creator && slug === 'polutek' && allowDemoFallbacks()) {
        return {
            id: DEFAULT_CREATOR.id,
            name: 'POLUTEK.PL',
            slug: DEFAULT_CREATOR.slug,
            imageUrl: adminData?.imageUrl || null,
            bannerUrl: null,
            bio: DEFAULT_CREATOR.bio,
            userId: undefined,
            subscribersCount: 1250000,
            videos: (INITIAL_VIDEOS as any[]).map(v => this.mapToPublicVideoDTO(v))
        };
      }

      if (!creator) return null;

      return {
          id: creator.id,
          name: creator.name,
          slug: creator.slug,
          imageUrl: creator.user?.imageUrl || null,
          bannerUrl: creator.bannerUrl,
          bio: creator.bio,
          userId: creator.userId,
          subscribersCount: creator.subscribersCount || 0,
          videos: (creator.videos || []).map((v: any) => this.mapToPublicVideoDTO({ ...v, creator }))
      };
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
  static async getAllVideos(): Promise<PublicVideoDTO[]> {
    try {
      const videos = await prisma.video.findMany({
        where: {
            status: VideoStatus.PUBLISHED,
            publishedAt: { lte: new Date() }
        },
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

      if (videos.length === 0 && allowDemoFallbacks()) {
          return (INITIAL_VIDEOS as any[]).map(v => this.mapToPublicVideoDTO(v));
      }
      return videos.map(v => this.mapToPublicVideoDTO(v));
    } catch (e: unknown) {
      console.error("[GET_ALL_VIDEOS_ERROR]", e);
      if (allowDemoFallbacks()) return (INITIAL_VIDEOS as any[]).map(v => this.mapToPublicVideoDTO(v));
      return [];
    }
  }

  /**
   * Fetches the main featured video from the database.
   */
  static async getMainFeaturedVideo(): Promise<PublicVideoDTO | null> {
    try {
      const video = await prisma.video.findFirst({
        where: {
            isMainFeatured: true,
            status: VideoStatus.PUBLISHED,
            publishedAt: { lte: new Date() }
        },
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

      if (!video && allowDemoFallbacks()) return this.mapToPublicVideoDTO(INITIAL_VIDEOS[0]);
      return video ? this.mapToPublicVideoDTO(video) : null;
    } catch (e: unknown) {
      console.error("[GET_MAIN_FEATURED_VIDEO_ERROR]", e);
      if (allowDemoFallbacks()) return this.mapToPublicVideoDTO(INITIAL_VIDEOS[0]);
      return null;
    }
  }
}
