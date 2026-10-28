import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import type { PublicCreatorHeaderDTO, PublicCreatorPageDTO, PublicVideoDTO } from '@/app/types/video';
import { canUseDemoFallbacks } from '@/lib/feature-flags';
import { VideoContentService, findMainCreatorAdminAvatar, publicVideoListOmit, publicVideoOrderBy } from '@/lib/modules/video/infrastructure/video-content.service';
import { MainChannelService, isMainChannelId, resolveMainChannelId } from '@/lib/modules/channel/application/main-channel.service';
import { resolveChannelAvatarUrl } from '@/lib/modules/channel/domain/channel-avatar';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { toPublicChannelAbout } from '@/lib/modules/channel/domain/channel-about';
import { MainChannelPolicy } from '@/lib/modules/channel/domain/channel.policy';

/** What the home page needs to know about the channel itself (metadata only, no video list). */
export type HomeCreatorSummary = Pick<PublicCreatorPageDTO, 'id' | 'name' | 'slug' | 'bio'>;

/** Videos per channel page request: the first render and each "More" (W04). */
export const CHANNEL_VIDEOS_PAGE_SIZE = 24;
export const CHANNEL_VIDEOS_PAGE_SIZE_MAX = 60;

/** What listing a channel's videos needs to know about the channel (the header carries all of it). */
export type ChannelVideosContext = Pick<PublicCreatorHeaderDTO, 'id' | 'name' | 'slug' | 'imageUrl' | 'subscribersCount'>;

/** The one rule for a channel's public video list (the page grid, its count and its summed views). */
const channelPublicVideosWhere = (creatorId: string, now: Date = new Date()) => ({
  creatorId,
  status: VideoStatus.PUBLISHED,
  moderationStatus: { not: 'REMOVED' as const },
  OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
});

const creatorHeaderInclude = { user: { select: { imageUrl: true, email: true } } } as const;

const findCreatorWithOwner = (id: string) => prisma.creator.findUnique({ where: { id }, include: creatorHeaderInclude });

export class CreatorContentService {
  /**
   * A public channel page's header: the channel without its videos (W04). `slug` is what the URL carries: the
   * channel's stable slug, its current handle (`/@handle`) or a handle it released in the last 180 days (the page
   * then redirects to the slug). Any publicly visible channel is served, not only the main one (CLAUDE.md 4.24).
   * The video count and the summed views are database aggregates; the videos come from getChannelVideosPage.
   * Callers in one request share it through `getChannelHeaderCached`.
   */
  static async getCreatorHeaderBySlug(slug: string | null): Promise<PublicCreatorHeaderDTO | null> {
    if (!slug) return null;
    // Only the demo fallbacks (development) need to know whether this slug is the main channel's.
    const isMainCreator = async () =>
      slug === DEFAULT_CREATOR.slug || slug === (await MainChannelService.getMainSlug(createAppContext()).catch(() => null));

    try {
      const include = creatorHeaderInclude;
      let creator = await prisma.creator.findUnique({ where: { slug }, include });
      if (!creator) {
        creator = await prisma.creator.findFirst({ where: { handle: { equals: slug, mode: 'insensitive' } }, include });
      }
      if (!creator) {
        const released = await prisma.channelHandleHistory.findFirst({
          where: { handle: { equals: slug, mode: 'insensitive' }, reservedUntil: { gt: new Date() } },
          orderBy: { releasedAt: 'desc' },
          select: { channelId: true },
        });
        if (released) creator = await prisma.creator.findUnique({ where: { id: released.channelId }, include });
      }

      if (creator && MainChannelPolicy.isPubliclyVisible(creator)) {
        return await this.buildCreatorHeader(creator);
      }

      if (!creator && canUseDemoFallbacks() && (await isMainCreator())) {
        const adminData = await findMainCreatorAdminAvatar();
        return {
            id: DEFAULT_CREATOR.id,
            name: DEFAULT_CREATOR.name,
            slug: DEFAULT_CREATOR.slug,
            imageUrl: adminData?.imageUrl || null,
            bio: DEFAULT_CREATOR.bio,
            userId: undefined,
            subscribersCount: 1250000,
            videoCount: INITIAL_VIDEOS.length,
        };
      }

      return null;
    } catch (e: unknown) {
      console.error("[GET_CREATOR_HEADER_BY_SLUG_ERROR]", e);
      if (canUseDemoFallbacks() && (await isMainCreator())) {
        return {
            ...DEFAULT_CREATOR,
            imageUrl: null,
            videoCount: INITIAL_VIDEOS.length,
        };
      }
      return null;
    }
  }

  private static async buildCreatorHeader(creator: NonNullable<Awaited<ReturnType<typeof findCreatorWithOwner>>>): Promise<PublicCreatorHeaderDTO> {
    const [adminData, totals] = await Promise.all([
      isMainChannelId(prisma, creator.id).then((isMain) => (isMain ? findMainCreatorAdminAvatar() : null)),
      prisma.video.aggregate({
        where: channelPublicVideosWhere(creator.id),
        _count: { _all: true },
        _sum: { views: true },
      }),
    ]);
    // Same rule as the home page's channel strip (resolveChannelAvatarUrl): the channel owner's
    // avatar, the first administrator's only as a fallback. Never the viewer's own image.
    const effectiveImageUrl = resolveChannelAvatarUrl({
      ownerImageUrl: creator.user?.imageUrl,
      adminImageUrl: adminData?.imageUrl,
    });
    return {
        id: creator.id,
        name: creator.name,
        slug: creator.slug,
        handle: creator.handle ?? null,
        imageUrl: effectiveImageUrl,
        bio: creator.bio,
        userId: creator.userId,
        subscribersCount: creator.subscribersCount ?? 0,
        about: { ...toPublicChannelAbout(creator, []), totalViews: totals._sum.views ?? 0 },
        videoCount: totals._count._all,
    };
  }

  /** The header of a publicly visible channel by its id (the "More" request of the channel page), or null. */
  static async getCreatorHeaderById(channelId: string): Promise<PublicCreatorHeaderDTO | null> {
    const creator = await findCreatorWithOwner(channelId);
    if (!creator || !MainChannelPolicy.isPubliclyVisible(creator)) return null;
    return this.buildCreatorHeader(creator);
  }

  /**
   * One page of a channel's public videos, in the channel page's order (W04). Only the list columns are read (no
   * descriptions); every video carries the channel as the page shows it. Pass the header that was already loaded
   * (getCreatorHeaderBySlug / ById): the channel's visibility is decided there.
   */
  static async getChannelVideosPage(
    channel: ChannelVideosContext,
    { offset = 0, limit = CHANNEL_VIDEOS_PAGE_SIZE }: { offset?: number; limit?: number } = {},
  ): Promise<PublicVideoDTO[]> {
    const skip = Math.max(Math.floor(offset), 0);
    const take = Math.min(Math.max(Math.floor(limit), 1), CHANNEL_VIDEOS_PAGE_SIZE_MAX);
    const asChannelVideo = (dto: PublicVideoDTO): PublicVideoDTO => ({
      ...dto,
      creator: {
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        imageUrl: channel.imageUrl ?? null,
        subscribersCount: channel.subscribersCount || 0,
      },
    });

    if (channel.id === DEFAULT_CREATOR.id && canUseDemoFallbacks()) {
      return INITIAL_VIDEOS.slice(skip, skip + take).map((v) => asChannelVideo(VideoContentService.mapToPublicVideoDTO(v)));
    }

    const videos = await prisma.video.findMany({
      where: channelPublicVideosWhere(channel.id),
      omit: publicVideoListOmit,
      // The id closes ties, so a page boundary never repeats or skips a video.
      orderBy: [...publicVideoOrderBy, { id: 'asc' }],
      skip,
      take,
    });
    return videos.map((v) => asChannelVideo(VideoContentService.mapToPublicVideoDTO(v)));
  }

  /**
   * The approved main channel's name and bio, from the same (request-cached) row the video queries
   * use, so the home page does not load the channel's whole video list a second time.
   */
  static async getConfiguredCreatorSummary(): Promise<HomeCreatorSummary | null> {
    const channel = await MainChannelService.getOptional(createAppContext());
    if (channel && MainChannelPolicy.isPubliclyVisible(channel)) {
      return { id: channel.id, name: channel.name, slug: channel.slug, bio: channel.bio };
    }
    if (!channel && canUseDemoFallbacks()) {
      return { id: DEFAULT_CREATOR.id, name: DEFAULT_CREATOR.name, slug: DEFAULT_CREATOR.slug, bio: DEFAULT_CREATOR.bio };
    }
    return null;
  }

  /**
   * Stable slugs of every publicly visible channel that has at least one published video, for the sitemap.
   * The main channel is listed separately by the caller; it is skipped here.
   */
  static async listPublicChannelSlugs(limit = 1000): Promise<string[]> {
    const mainId = await resolveMainChannelId(prisma);
    const rows = await prisma.creator.findMany({
      where: {
        ...(mainId ? { id: { not: mainId } } : {}),
        deletedAt: null,
        status: { in: ['ACTIVE', 'LIMITED'] },
        videos: { some: { status: VideoStatus.PUBLISHED, moderationStatus: { not: 'REMOVED' } } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  }

  /** Publicly visible channels whose name or handle matches `query` (search page). Short queries match nothing. */
  static async searchPublicChannels(query: string, limit = 12): Promise<{ id: string; slug: string; name: string; handle: string | null }[]> {
    const q = query.trim().replace(/^@/, '').slice(0, 60);
    if (q.length < 2) return [];
    return prisma.creator.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'LIMITED'] },
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { handle: { contains: q, mode: 'insensitive' } }],
      },
      orderBy: [{ subscribersCount: 'desc' }, { name: 'asc' }],
      take: limit,
      select: { id: true, slug: true, name: true, handle: true },
    });
  }

  static async getConfiguredOrDefaultCreator(): Promise<PublicCreatorHeaderDTO | null> {
    const slug = await MainChannelService.getMainSlug(createAppContext()).catch(() => null);
    return this.getCreatorHeaderBySlug(slug ?? (canUseDemoFallbacks() ? DEFAULT_CREATOR.slug : null));
  }
}
