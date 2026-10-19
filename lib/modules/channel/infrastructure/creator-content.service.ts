import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { PublicCreatorPageDTO } from '@/app/types/video';
import { canUseDemoFallbacks } from '@/lib/feature-flags';
import { VideoContentService, findMainCreatorAdminAvatar, publicVideoOrderBy } from '@/lib/modules/video/infrastructure/video-content.service';
import { MainChannelService, isMainChannelId, resolveMainChannelId } from '@/lib/modules/channel/application/main-channel.service';
import { resolveChannelAvatarUrl } from '@/lib/modules/channel/domain/channel-avatar';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { toPublicChannelAbout } from '@/lib/modules/channel/domain/channel-about';
import { MainChannelPolicy } from '@/lib/modules/channel/domain/channel.policy';

/** What the home page needs to know about the channel itself (metadata only, no video list). */
export type HomeCreatorSummary = Pick<PublicCreatorPageDTO, 'id' | 'name' | 'slug' | 'bio'>;

export class CreatorContentService {
  /**
   * A public channel page's data. `slug` is what the URL carries: the channel's stable slug, its current handle
   * (`/@handle`) or a handle it released in the last 180 days (the page then redirects to the slug). Any
   * publicly visible channel is served, not only the main one (CLAUDE.md 4.24).
   */
  static async getCreatorBySlug(slug: string | null): Promise<PublicCreatorPageDTO | null> {
    if (!slug) return null;
    // Only the demo fallbacks (development) need to know whether this slug is the main channel's.
    const isMainCreator = async () =>
      slug === DEFAULT_CREATOR.slug || slug === (await MainChannelService.getMainSlug(createAppContext()).catch(() => null));

    try {
      const include = {
        user: {
          select: { imageUrl: true, email: true }
        },
        videos: {
          where: {
            status: VideoStatus.PUBLISHED,
            moderationStatus: { not: 'REMOVED' as const },
            OR: [
              { publishedAt: null },
              { publishedAt: { lte: new Date() } },
            ],
          },
          orderBy: publicVideoOrderBy,
        }
      };
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

      const adminData = creator && (await isMainChannelId(prisma, creator.id)) ? await findMainCreatorAdminAvatar() : null;

      if (creator && MainChannelPolicy.isPubliclyVisible(creator)) {
        // Same rule as the home page's channel strip (resolveChannelAvatarUrl): the channel owner's
        // avatar, the first administrator's only as a fallback. Never the viewer's own image.
        const effectiveImageUrl = resolveChannelAvatarUrl({
          ownerImageUrl: creator.user?.imageUrl,
          adminImageUrl: adminData?.imageUrl,
        });
        const videos = (creator.videos || []).map((v) =>
          VideoContentService.mapToPublicVideoDTO({
              ...v,
              creator: { ...creator, imageUrl: adminData?.imageUrl ?? null }
          })
        );

        return {
            id: creator.id,
            name: creator.name,
            slug: creator.slug,
            handle: creator.handle ?? null,
            imageUrl: effectiveImageUrl,
            bio: creator.bio,
            userId: creator.userId,
            subscribersCount: creator.subscribersCount ?? 0,
            about: toPublicChannelAbout(creator, videos),
            videos
        };
      }

      if (!creator && canUseDemoFallbacks() && (await isMainCreator())) {
        return {
            id: DEFAULT_CREATOR.id,
            name: DEFAULT_CREATOR.name,
            slug: DEFAULT_CREATOR.slug,
            imageUrl: adminData?.imageUrl || null,
            bio: DEFAULT_CREATOR.bio,
            userId: undefined,
            subscribersCount: 1250000,
            videos: INITIAL_VIDEOS.map(v => VideoContentService.mapToPublicVideoDTO(v))
        };
      }

      return null;
    } catch (e: unknown) {
      console.error("[GET_CREATOR_BY_SLUG_ERROR]", e);
      if (canUseDemoFallbacks() && (await isMainCreator())) {
        return {
            ...DEFAULT_CREATOR,
            imageUrl: null,
            videos: INITIAL_VIDEOS.map(v => VideoContentService.mapToPublicVideoDTO(v))
        };
      }
      return null;
    }
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

  static async getConfiguredOrDefaultCreator(): Promise<PublicCreatorPageDTO | null> {
    const slug = await MainChannelService.getMainSlug(createAppContext()).catch(() => null);
    return this.getCreatorBySlug(slug ?? (canUseDemoFallbacks() ? DEFAULT_CREATOR.slug : null));
  }
}
