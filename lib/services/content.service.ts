import { prisma } from '@/lib/prisma';
import { AccessTier, Prisma, VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { ADMIN_EMAIL } from '../constants';
import { PublicVideoDTO, PublicCreatorDTO, PublicCreatorPageDTO } from '@/app/types/video';
import { flags } from '../feature-flags';



export function buildPublishedVideoWhere(now = new Date()): Prisma.VideoWhereInput {
  return {
    status: VideoStatus.PUBLISHED,
    OR: [
      { publishedAt: null },
      { publishedAt: { lte: now } },
    ],
  };
}

export function buildVisibleVideoWhere(now = new Date()): Prisma.VideoWhereInput {
  return {
    ...buildPublishedVideoWhere(now),
    creator: {
      isApproved: true,
    },
  };
}

export function buildMainFeaturedVideoWhere(now = new Date()): Prisma.VideoWhereInput {
  return {
    ...buildVisibleVideoWhere(now),
    isMainFeatured: true,
  };
}

type PublicCreatorInput = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  user?: { imageUrl?: string | null } | null;
  subscribersCount?: number | null;
};

type PublicVideoInput = {
  id: string;
  creatorId?: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status?: VideoStatus;
  views?: number;
  likesCount?: number;
  dislikesCount?: number;
  isMainFeatured?: boolean;
  publishedAt?: Date | string | null;
  creator?: PublicCreatorInput | null;
};

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
        return flags.demoFallbacks ? INITIAL_VIDEOS.find(v => v.id === videoId) || null : null;
      }

      return video;
    } catch (e: unknown) {
      console.error("[GET_VIDEO_BY_ID_ERROR]", e);
      return flags.demoFallbacks ? INITIAL_VIDEOS.find(v => v.id === videoId) || null : null;
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
  private static mapToPublicCreatorDTO(creator: PublicCreatorInput): PublicCreatorDTO {
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
  private static mapToPublicVideoDTO(video: PublicVideoInput): PublicVideoDTO {
    return {
        id: video.id,
        creatorId: video.creatorId ?? '',
        title: video.title,
        slug: video.slug,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        tier: video.tier,
        status: video.status ?? VideoStatus.PUBLISHED,
        views: video.views ?? 0,
        likesCount: video.likesCount ?? 0,
        dislikesCount: video.dislikesCount ?? 0,
        isMainFeatured: video.isMainFeatured ?? false,
        publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
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
            where: buildPublishedVideoWhere(),
            orderBy: [
              { publishedAt: 'desc' },
              { createdAt: 'desc' },
            ]
          }
        }
      });

      const adminData = slug === 'polutek' ? await this.getAdminData() : null;

      if (slug === 'polutek' && creator) {
        // Map data strictly to prevent leakage
        const videos = (creator.videos || []).map((v) => this.mapToPublicVideoDTO({ ...v, creator }));

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

      if (!creator && slug === 'polutek' && flags.demoFallbacks) {
        return {
            id: DEFAULT_CREATOR.id,
            name: 'POLUTEK.PL',
            slug: DEFAULT_CREATOR.slug,
            imageUrl: adminData?.imageUrl || null,
            bannerUrl: null,
            bio: DEFAULT_CREATOR.bio,
            userId: undefined,
            subscribersCount: 1250000,
            videos: INITIAL_VIDEOS.map(v => this.mapToPublicVideoDTO(v))
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
          videos: (creator.videos || []).map((v) => this.mapToPublicVideoDTO({ ...v, creator }))
      };
    } catch (e: unknown) {
      console.error("[GET_CREATOR_BY_SLUG_ERROR]", e);
      if (slug === 'polutek' && flags.demoFallbacks) {
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
        where: buildVisibleVideoWhere(),
        include: {
          creator: {
            include: {
              user: {
                select: { imageUrl: true, email: true }
              }
            }
          }
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ]
      });

      if (videos.length === 0 && flags.demoFallbacks) {
          return INITIAL_VIDEOS.map(v => this.mapToPublicVideoDTO(v));
      }
      return videos.map(v => this.mapToPublicVideoDTO(v));
    } catch (e: unknown) {
      console.error("[GET_ALL_VIDEOS_ERROR]", e);
      if (flags.demoFallbacks) return INITIAL_VIDEOS.map(v => this.mapToPublicVideoDTO(v));
      return [];
    }
  }

  /**
   * Fetches the main featured video from the database.
   */
  static async getMainFeaturedVideo(): Promise<PublicVideoDTO | null> {
    try {
      const video = await prisma.video.findFirst({
        where: buildMainFeaturedVideoWhere(),
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

      if (!video && flags.demoFallbacks) return this.mapToPublicVideoDTO(INITIAL_VIDEOS[0]);
      return video ? this.mapToPublicVideoDTO(video) : null;
    } catch (e: unknown) {
      console.error("[GET_MAIN_FEATURED_VIDEO_ERROR]", e);
      if (flags.demoFallbacks) return this.mapToPublicVideoDTO(INITIAL_VIDEOS[0]);
      return null;
    }
  }
}
