import { prisma } from '@/lib/prisma';
import { AccessTier, VideoStatus, Prisma } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { PublicVideoDTO } from '@/app/types/video';
import { canUseDemoFallbacks, flags } from '@/lib/feature-flags';
import { getCanonicalVideoTitle } from '@/lib/video-title-overrides';
import { getAdminClerkUserIds } from '@/lib/admin-config';
import { MainChannelService } from '@/lib/channel/main-channel.service';

export const visiblePublishedAtFilter = (now: Date): Prisma.VideoWhereInput => ({
  OR: [
    { publishedAt: null },
    { publishedAt: { lte: now } },
  ],
});

export async function buildPublicVideoWhere(now: Date = new Date()): Promise<Prisma.VideoWhereInput> {
  const mainChannel = await MainChannelService.getOptional();
  return {
    status: VideoStatus.PUBLISHED,
    creatorId: mainChannel?.id || 'none',
    creator: {
      isApproved: true,
      isPrimary: true,
    },
    ...visiblePublishedAtFilter(now),
  };
}

export const publicVideoOrderBy: Prisma.VideoOrderByWithRelationInput[] = [
  { sidebarOrder: 'asc' },
  { publishedAt: 'desc' },
  { createdAt: 'desc' },
];

export class VideoContentService {
  /**
   * Returns only PUBLIC and PUBLISHED videos for sitemap indexing.
   * Strictly excludes PATRON and LOGGED_IN tiers.
   */
  static async getSitemapVideos(): Promise<PublicVideoDTO[]> {
    const mainChannel = await MainChannelService.getOptional();
    const now = new Date();

    const videos = await prisma.video.findMany({
      where: {
        status: VideoStatus.PUBLISHED,
        tier: AccessTier.PUBLIC,
        creatorId: mainChannel?.id || 'none',
        ...visiblePublishedAtFilter(now),
        creator: {
          isApproved: true,
          isPrimary: true,
        },
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

    return videos.map(v => this.mapToPublicVideoDTO(v));
  }

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
        return canUseDemoFallbacks() ? INITIAL_VIDEOS.find(v => v.id === videoId) || null : null;
      }

      return video;
    } catch (e: unknown) {
      console.error("[GET_VIDEO_BY_ID_ERROR]", e);
      return canUseDemoFallbacks() ? INITIAL_VIDEOS.find(v => v.id === videoId) || null : null;
    }
  }

  static mapToPublicVideoDTO(video: any): PublicVideoDTO {
    const dto: PublicVideoDTO = {
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
        creator: video.creator ? {
            id: video.creator.id,
            name: video.creator.name,
            slug: video.creator.slug,
            imageUrl: video.creator.user?.imageUrl || video.creator.imageUrl || null,
            subscribersCount: video.creator.subscribersCount ?? 0,
        } : undefined,
    };

    // Safety redaction
    const forbidden = ['videoUrl', 'sourceUrl', 'rawUrl', 'signedUrl', 'providerUrl', 's3Url', 'blobUrl'];
    for (const field of forbidden) {
        if (field in dto) delete (dto as any)[field];
    }

    return dto;
  }

  static async getAllVideos(): Promise<PublicVideoDTO[]> {
    try {
      const videos = await prisma.video.findMany({
        where: {
          ...(await buildPublicVideoWhere()),
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

      if (videos.length === 0 && canUseDemoFallbacks()) {
          return INITIAL_VIDEOS
            .filter(v => (v.tier as string) !== 'ADMIN')
            .map(v => this.mapToPublicVideoDTO(v));
      }

      const adminIds = getAdminClerkUserIds();
      const adminData = adminIds.length > 0 ? await prisma.user.findFirst({
        where: { id: { in: adminIds }, isDeleted: false },
        select: { imageUrl: true }
      }) : null;

      const mainCreatorSlug = flags.mainCreatorSlug;

      return videos.map(v => {
          let imageUrl = v.creator?.user?.imageUrl || null;
          if (v.creator?.slug === mainCreatorSlug && adminData?.imageUrl) {
              imageUrl = adminData.imageUrl;
          }
          return this.mapToPublicVideoDTO({
            ...v,
            creator: v.creator ? { ...v.creator, imageUrl } : null
          });
      });
    } catch (e: unknown) {
      console.error("[GET_ALL_VIDEOS_ERROR]", e);
      if (canUseDemoFallbacks()) return INITIAL_VIDEOS.filter(v => (v.tier as string) !== 'ADMIN').map(v => this.mapToPublicVideoDTO(v));
      throw e;
    }
  }

  static async getMainFeaturedVideo(): Promise<PublicVideoDTO | null> {
    try {
      const publicWhere = await buildPublicVideoWhere();
      const video = await prisma.video.findFirst({
        where: {
            ...publicWhere,
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
          ...publicWhere,
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

      if (!selectedVideo && canUseDemoFallbacks()) {
        const fallback = INITIAL_VIDEOS.find(v => v.tier === AccessTier.PUBLIC && v.status === VideoStatus.PUBLISHED) || INITIAL_VIDEOS[0];
        return this.mapToPublicVideoDTO(fallback);
      }
      if (!selectedVideo) return null;

      const adminIds = getAdminClerkUserIds();
      const adminData = adminIds.length > 0 ? await prisma.user.findFirst({
        where: { id: { in: adminIds }, isDeleted: false },
        select: { imageUrl: true }
      }) : null;

      const mainCreatorSlug = flags.mainCreatorSlug;
      let imageUrl = selectedVideo.creator?.user?.imageUrl || null;
      if (selectedVideo.creator?.slug === mainCreatorSlug && adminData?.imageUrl) {
          imageUrl = adminData.imageUrl;
      }

      return this.mapToPublicVideoDTO({
        ...selectedVideo,
        creator: selectedVideo.creator ? { ...selectedVideo.creator, imageUrl } : null
      });
    } catch (e: unknown) {
      console.error("[GET_MAIN_FEATURED_VIDEO_ERROR]", e);
      if (canUseDemoFallbacks()) return this.mapToPublicVideoDTO(INITIAL_VIDEOS[0]);
      throw e;
    }
  }

  static async getVideoAccess(userId: string | null, videoId: string) {
    const { checkVideoAccess } = await import('@/lib/modules/access');
    const { getActorFromAuth, resolveDbBackedActor } = await import('@/lib/api/auth');
    const { createAppContext } = await import('@/lib/modules/shared/app-context');

    // IMPORTANT: This bridge is used by legacy-style loaders.
    // It resolves the actor based on the provided userId if present,
    // otherwise it falls back to the ambient auth session (Server Components/API).
    let actor;
    if (userId) {
        actor = await resolveDbBackedActor(userId).catch(() => ({ type: 'guest' } as const));
    } else {
        actor = await getActorFromAuth();
    }

    const ctx = createAppContext({ actor });

    const result = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);

    if (!result.ok) {
        return {
            hasAccess: false,
            reason: 'FORBIDDEN' as const,
            requiredTier: undefined
        };
    }

    return {
        hasAccess: result.data.hasAccess,
        reason: result.data.reason,
        requiredTier: result.data.requiredTier
    };
  }
}
