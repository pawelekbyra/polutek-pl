import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { AccessTier, VideoStatus, Prisma } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { PublicVideoDTO } from '@/app/types/video';
import { canUseDemoFallbacks } from '@/lib/feature-flags';
import { getCanonicalVideoTitle } from '@/lib/video-title-overrides';
import { MainChannelService, publiclyVisibleChannelWhere, resolveChannelAvatarUrl, resolveMainChannelId } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { MediaPolicy, resolvePublicThumbnailSrc } from '@/lib/modules/media';
import { effectivePublishedAt, toPremiereDate } from '../domain/premiere';
import { withFundraisingProgress } from './fundraising-progress.service';
import { toVideoAccessTier } from '@/lib/access-tier';
import { isVideoPubliclyVisible } from '../domain/public-visibility';
import { isAdultVideo } from '../domain/video-visibility';
import { isVideoCategory } from '@/lib/video-metadata';

export const visiblePublishedAtFilter = (now: Date): Prisma.VideoWhereInput => ({
  OR: [
    { publishedAt: null },
    { publishedAt: { lte: now } },
  ],
});

export async function buildPublicVideoWhere(now: Date = new Date()): Promise<Prisma.VideoWhereInput> {
  const mainChannel = await MainChannelService.getOptional(createAppContext());
  return {
    status: VideoStatus.PUBLISHED,
    creatorId: mainChannel?.id || 'none',
    creator: publiclyVisibleChannelWhere(),
    ...visiblePublishedAtFilter(now),
  };
}

/**
 * The first admin's avatar: the fallback for the main creator's picture when the channel owner account
 * has none (`resolveChannelAvatarUrl`; it is never the logged-in viewer's image). Read once per server render
 * (the video list, the featured video and the creator page all ask for it); React `cache` does not
 * memoize outside a render.
 */
export const findMainCreatorAdminAvatar = cache(() =>
  prisma.user.findFirst({
    where: { role: 'ADMIN', isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { imageUrl: true },
  }),
);

export const publicVideoOrderBy: Prisma.VideoOrderByWithRelationInput[] = [
  { sidebarOrder: 'asc' },
  { publishedAt: 'desc' },
  { createdAt: 'desc' },
];

export class VideoContentService {
  /**
   * Returns only PUBLIC and PUBLISHED videos for sitemap indexing.
   * Strictly excludes LOGGED_IN videos, UNLISTED videos (link-only) and adult videos (signed-in viewers only:
   * the creator's 18+ declaration and the AGE_RESTRICTED moderation state).
   */
  static async getSitemapVideos(): Promise<PublicVideoDTO[]> {
    const mainChannel = await MainChannelService.getOptional(createAppContext());
    const now = new Date();

    const videos = await prisma.video.findMany({
      where: {
        status: VideoStatus.PUBLISHED,
        tier: AccessTier.PUBLIC,
        isAdult: false,
        moderationStatus: { notIn: ['AGE_RESTRICTED', 'REMOVED'] },
        creatorId: mainChannel?.id || 'none',
        ...visiblePublishedAtFilter(now),
        creator: publiclyVisibleChannelWhere(),
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
        thumbnailUrl: resolvePublicThumbnailSrc(video, process.env),
        duration: video.duration,
        tier: toVideoAccessTier(video.tier),
        status: video.status ?? VideoStatus.PUBLISHED,
        views: video.views ?? 0,
        likesCount: video.likesCount ?? 0,
        dislikesCount: video.dislikesCount ?? 0,
        isMainFeatured: video.isMainFeatured ?? false,
        sidebarOrder: video.sidebarOrder ?? 0,
        publishedAt: effectivePublishedAt(video),
        premiereAt: toPremiereDate(video.premiereAt)?.toISOString() ?? null,
        isAdult: isAdultVideo(video),
        tags: Array.isArray(video.tags) ? video.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
        category: isVideoCategory(video.category) ? video.category : null,
        creator: video.creator ? {
            id: video.creator.id,
            name: video.creator.name,
            slug: video.creator.slug,
            // The one channel avatar rule (lib/modules/channel/domain/channel-avatar.ts). `creator.imageUrl`
            // here is only the administrator fallback injected by the callers below, never a viewer image.
            imageUrl: resolveChannelAvatarUrl({
              ownerImageUrl: video.creator.user?.imageUrl,
              adminImageUrl: video.creator.imageUrl,
            }),
            subscribersCount: video.creator.subscribersCount ?? 0,
        } : undefined,
    };

    // Fail-safe: throws if this DTO ever carries a raw/internal media field. mapToPublicVideoDTO
    // is the single point where every PublicVideoDTO in the app is built, so this is the one
    // place that guarantees the CLAUDE.md §4.3 invariant even if a future edit here regresses it.
    MediaPolicy.assertPublicVideoDtoSafe(dto);

    return dto;
  }

  /**
   * The newest public videos of the given channels (the "My subscriptions" stream): published, not removed,
   * of a publicly visible channel (CLAUDE.md 4.24), newest first. Ids come from the viewer's own subscriptions.
   */
  static async getLatestPublicVideosForChannels(channelIds: string[], limit = 30): Promise<PublicVideoDTO[]> {
    if (channelIds.length === 0) return [];
    const take = Math.min(Math.max(limit, 1), 60);
    const videos = await prisma.video.findMany({
      where: {
        creatorId: { in: channelIds },
        status: VideoStatus.PUBLISHED,
        moderationStatus: { not: 'REMOVED' },
        creator: publiclyVisibleChannelWhere(),
        ...visiblePublishedAtFilter(new Date()),
      },
      include: {
        creator: { include: { user: { select: { imageUrl: true, email: true } } } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
    });
    return videos.map((v) => this.mapToPublicVideoDTO(v));
  }

  static async getAllVideos(): Promise<PublicVideoDTO[]> {
    try {
      const videos = await prisma.video.findMany({
        where: {
          ...(await buildPublicVideoWhere()),
          showInSidebar: true,
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

      const adminData = await findMainCreatorAdminAvatar();

      const mainChannelId = await resolveMainChannelId(prisma);

      const dtos = videos.map(v => this.mapToPublicVideoDTO({
        ...v,
        // Administrator fallback only for the main channel; the owner's own avatar still wins (see mapToPublicVideoDTO).
        creator: v.creator
          ? { ...v.creator, imageUrl: v.creator.id === mainChannelId ? adminData?.imageUrl ?? null : null }
          : null,
      }));
      // Amount-free goal progress (CLAUDE.md "Fundraising progress bar").
      return await withFundraisingProgress(dtos, videos);
    } catch (e: unknown) {
      console.error("[GET_ALL_VIDEOS_ERROR]", e);
      if (canUseDemoFallbacks()) return INITIAL_VIDEOS.filter(v => (v.tier as string) !== 'ADMIN').map(v => this.mapToPublicVideoDTO(v));
      throw e;
    }
  }

  /**
   * One video by id or slug for the public page, from any channel (slugs are globally unique), or null when the
   * viewer must not see it: not found, not PUBLISHED or not yet due, removed by moderation, or on a channel that
   * is not publicly visible (CLAUDE.md 4.24). Every refusal looks the same, so nothing about a hidden video leaks.
   * Staff and channel previews are not applied here: an unpublished video is never shown on the public page.
   */
  static async getPublicVideoByIdOrSlug(idOrSlug: string): Promise<PublicVideoDTO | null> {
    const key = idOrSlug.trim();
    if (!key || key.length > 200) return null;
    try {
      const video = await prisma.video.findFirst({
        where: { OR: [{ id: key }, { slug: key }] },
        include: {
          creator: {
            include: {
              user: { select: { imageUrl: true, email: true } },
            },
          },
        },
      });
      if (!video || !isVideoPubliclyVisible(video as any)) return null;

      const adminData = await findMainCreatorAdminAvatar();
      const creator = video.creator
        ? { ...video.creator, imageUrl: video.creator.id === (await resolveMainChannelId(prisma)) ? adminData?.imageUrl ?? null : null }
        : null;
      const [dto] = await withFundraisingProgress([this.mapToPublicVideoDTO({ ...video, creator })], [video]);
      return dto;
    } catch (e: unknown) {
      console.error("[GET_PUBLIC_VIDEO_BY_ID_OR_SLUG_ERROR]", e);
      return null;
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

      const adminData = await findMainCreatorAdminAvatar();

      const mainChannelId = await resolveMainChannelId(prisma);
      const adminFallbackImageUrl =
        selectedVideo.creator?.id === mainChannelId ? adminData?.imageUrl ?? null : null;

      const [dto] = await withFundraisingProgress([this.mapToPublicVideoDTO({
        ...selectedVideo,
        creator: selectedVideo.creator ? { ...selectedVideo.creator, imageUrl: adminFallbackImageUrl } : null
      })], [selectedVideo]);
      return dto;
    } catch (e: unknown) {
      console.error("[GET_MAIN_FEATURED_VIDEO_ERROR]", e);
      if (canUseDemoFallbacks()) return this.mapToPublicVideoDTO(INITIAL_VIDEOS[0]);
      throw e;
    }
  }

  static async getVideoAccess(userId: string | null, videoId: string) {
    const { checkVideoAccess } = await import('@/lib/modules/access');
    const { resolveDbBackedActor } = await import('@/lib/api/auth');
    const { createAppContext } = await import('@/lib/modules/shared/app-context');

    const actor = userId
      ? await resolveDbBackedActor(userId)
      : { type: 'guest' } as const;

    const ctx = createAppContext({ actor });
    const result = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);

    if (!result.ok) {
        return {
            hasAccess: false,
            reason: 'FORBIDDEN' as const,
        };
    }

    return {
        hasAccess: result.data.hasAccess,
        reason: result.data.reason,
        requiredTier: result.data.requiredTier
    };
  }
}
