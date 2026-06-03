import { prisma } from '@/lib/prisma';
import { AccessTier, Prisma, VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { ADMIN_EMAIL } from '../constants';
import { PublicVideoDTO, PublicCreatorDTO, PublicCreatorPageDTO } from '@/app/types/video';
import { flags } from '../feature-flags';
import { isPubliclyVisibleVideo } from './content.visibility';
import { getCanonicalVideoTitle } from '@/lib/video-title-overrides';

const visiblePublishedAtFilter = (now: Date): Prisma.VideoWhereInput => ({
  OR: [
    { publishedAt: null },
    { publishedAt: { lte: now } },
  ],
});


export interface PublicVisibilityVideo {
  status: VideoStatus;
  publishedAt: Date | string | null;
  creator: {
    isApproved: boolean;
  };
}


export function buildPublicVideoWhere(now: Date = new Date()): Prisma.VideoWhereInput {
  return {
    status: VideoStatus.PUBLISHED,
    creator: {
      isApproved: true,
    },
    ...visiblePublishedAtFilter(now),
  };
}

export const publicVideoOrderBy: Prisma.VideoOrderByWithRelationInput[] = [
  { sidebarOrder: 'asc' },
  { publishedAt: 'desc' },
  { createdAt: 'desc' },
];

type PublicCreatorInput = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  user?: { imageUrl?: string | null } | null;
  subscribersCount?: number | null;
};

function withResolvedChannelAvatar<T extends PublicCreatorInput>(creator: T, adminImageUrl?: string | null): T {
  const imageUrl = adminImageUrl || creator.user?.imageUrl || creator.imageUrl || null;

  return {
    ...creator,
    imageUrl,
    user: creator.user ? { ...creator.user, imageUrl } : creator.user,
  };
}

type PublicVideoInput = {
  id: string;
  creatorId?: string;
  title: string;
  titleEn?: string | null;
  slug: string;
  description?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status?: VideoStatus;
  views?: number;
  likesCount?: number;
  dislikesCount?: number;
  isMainFeatured?: boolean;
  sidebarOrder?: number;
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
        imageUrl: creator.user?.imageUrl || creator.imageUrl || null,
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
        title: getCanonicalVideoTitle(video),
        titleEn: video.titleEn,
        slug: video.slug,
        description: video.description,
        descriptionEn: video.descriptionEn,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        tier: video.tier,
        status: video.status ?? VideoStatus.PUBLISHED,
        views: video.views ?? 0,
        likesCount: video.likesCount ?? 0,
        dislikesCount: video.dislikesCount ?? 0,
        isMainFeatured: video.isMainFeatured ?? false,
        sidebarOrder: video.sidebarOrder ?? 0,
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
            where: {
              status: VideoStatus.PUBLISHED,
              OR: [
                { publishedAt: null },
                { publishedAt: { lte: new Date() } },
              ],
            },
            orderBy: publicVideoOrderBy,
          }
        }
      });

      const adminData = slug === 'polutek' ? await this.getAdminData() : null;

      if (slug === 'polutek' && creator) {
        // Map data strictly to prevent leakage
        const videos = (creator.videos || []).map((v) =>
          this.mapToPublicVideoDTO({ ...v, creator: withResolvedChannelAvatar(creator, adminData?.imageUrl) })
        );

        return {
            id: creator.id,
            name: creator.name,
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
            name: DEFAULT_CREATOR.name,
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
          videos: (creator.videos || []).map((v) => this.mapToPublicVideoDTO({ ...v, creator: withResolvedChannelAvatar(creator) }))
      };
    } catch (e: unknown) {
      console.error("[GET_CREATOR_BY_SLUG_ERROR]", e);
      if (slug === 'polutek' && flags.demoFallbacks) {
        return {
            ...DEFAULT_CREATOR,
            videos: INITIAL_VIDEOS
        };
      }
      throw e;
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
   * Fetches all videos from the database for sidebar/listing, falling back to initial content.
   * Filters by showInSidebar=true and specific allowed tiers.
   */
  static async getAllVideos(): Promise<PublicVideoDTO[]> {
    try {
      const videos = await prisma.video.findMany({
        where: {
          ...buildPublicVideoWhere(),
          showInSidebar: true,
          tier: {
            in: [AccessTier.PUBLIC, AccessTier.LOGGED_IN, AccessTier.PATRON]
          }
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
        orderBy: publicVideoOrderBy
      });

      if (process.env.DEBUG_HOME_CONTENT === "true") {
        console.log("[HOME_CONTENT_DEBUG] getAllVideos", {
          foundInDb: videos.length,
          demoFallbacksEnabled: flags.demoFallbacks
        });
      }
      if (videos.length === 0 && flags.demoFallbacks) {
          return INITIAL_VIDEOS
            .filter(v => (v.tier as string) !== 'ADMIN')
            .map(v => this.mapToPublicVideoDTO(v));
      }
      const adminData = videos.some(v => v.creator?.slug === 'polutek') ? await this.getAdminData() : null;
      return videos.map(v => this.mapToPublicVideoDTO({
        ...v,
        creator: v.creator
          ? withResolvedChannelAvatar(v.creator, v.creator.slug === 'polutek' ? adminData?.imageUrl : null)
          : v.creator
      }));
    } catch (e: unknown) {
      console.error("[GET_ALL_VIDEOS_ERROR]", e);
      if (flags.demoFallbacks) return INITIAL_VIDEOS.filter(v => (v.tier as string) !== 'ADMIN').map(v => this.mapToPublicVideoDTO(v));
      // Re-throw so the page knows it was an error, not just an empty DB
      throw e;
    }
  }

  /**
   * Fetches the main featured video from the database.
   * Strictly PUBLIC + PUBLISHED.
   */
  static async getMainFeaturedVideo(): Promise<PublicVideoDTO | null> {
    try {
      const video = await prisma.video.findFirst({
        where: {
            ...buildPublicVideoWhere(),
            tier: AccessTier.PUBLIC,
            isMainFeatured: true,
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

      const selectedVideo = video ?? await prisma.video.findFirst({
        where: {
          ...buildPublicVideoWhere(),
          tier: AccessTier.PUBLIC,
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
        orderBy: publicVideoOrderBy,
      });

      if (process.env.DEBUG_HOME_CONTENT === "true") {
        console.log("[HOME_CONTENT_DEBUG] getMainFeaturedVideo", {
          featuredFound: !!video,
          fallbackFound: !!selectedVideo,
          demoFallbacksEnabled: flags.demoFallbacks
        });
      }
      if (!selectedVideo && flags.demoFallbacks) {
        const fallback = INITIAL_VIDEOS.find(v => v.tier === AccessTier.PUBLIC && v.status === VideoStatus.PUBLISHED) || INITIAL_VIDEOS[0];
        return this.mapToPublicVideoDTO(fallback);
      }
      if (!selectedVideo) return null;
      const adminData = selectedVideo.creator?.slug === 'polutek' ? await this.getAdminData() : null;
      return this.mapToPublicVideoDTO({
        ...selectedVideo,
        creator: selectedVideo.creator
          ? withResolvedChannelAvatar(selectedVideo.creator, adminData?.imageUrl)
          : selectedVideo.creator
      });
    } catch (e: unknown) {
      console.error("[GET_MAIN_FEATURED_VIDEO_ERROR]", e);
      if (flags.demoFallbacks) return this.mapToPublicVideoDTO(INITIAL_VIDEOS[0]);
      throw e;
    }
  }
}
