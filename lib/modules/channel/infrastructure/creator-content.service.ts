import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { PublicCreatorPageDTO } from '@/app/types/video';
import { canUseDemoFallbacks } from '@/lib/feature-flags';
import { VideoContentService, findMainCreatorAdminAvatar, publicVideoOrderBy } from '@/lib/modules/video/infrastructure/video-content.service';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';
import { resolveChannelAvatarUrl } from '@/lib/modules/channel/domain/channel-avatar';
import { createAppContext } from '@/lib/modules/shared/app-context';

/** What the home page needs to know about the channel itself (metadata only, no video list). */
export type HomeCreatorSummary = Pick<PublicCreatorPageDTO, 'id' | 'name' | 'slug' | 'bio'>;

export class CreatorContentService {
  static async getCreatorBySlug(slug: string | null): Promise<PublicCreatorPageDTO | null> {
    if (!slug) return null;
    const mainCreatorSlug = MainChannelService.getConfiguredSlug();
    const isMainCreator = slug === mainCreatorSlug;

    if (!isMainCreator) return null;

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

      const adminData = isMainCreator ? await findMainCreatorAdminAvatar() : null;

      if (creator && creator.isApproved && creator.isPrimary) {
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
            imageUrl: effectiveImageUrl,
            bio: creator.bio,
            userId: creator.userId,
            subscribersCount: creator.subscribersCount ?? 0,
            videos
        };
      }

      if (!creator && canUseDemoFallbacks()) {
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
      if (canUseDemoFallbacks()) {
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
    if (channel?.isApproved && channel.isPrimary) {
      return { id: channel.id, name: channel.name, slug: channel.slug, bio: channel.bio };
    }
    if (!channel && canUseDemoFallbacks()) {
      return { id: DEFAULT_CREATOR.id, name: DEFAULT_CREATOR.name, slug: DEFAULT_CREATOR.slug, bio: DEFAULT_CREATOR.bio };
    }
    return null;
  }

  static async getConfiguredOrDefaultCreator(): Promise<PublicCreatorPageDTO | null> {
    const slug = MainChannelService.getConfiguredSlug();
    return this.getCreatorBySlug(slug);
  }
}
