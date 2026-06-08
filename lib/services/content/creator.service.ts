import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { PublicCreatorPageDTO } from '@/app/types/video';
import { canUseDemoFallbacks } from '@/lib/feature-flags';
import { getAdminClerkUserIds } from '@/lib/admin-config';
import { VideoContentService, publicVideoOrderBy } from './video.service';
import { MainChannelService } from '@/lib/channel/main-channel.service';

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

      const adminIds = getAdminClerkUserIds();
      const adminData = (isMainCreator && adminIds.length > 0) ? await prisma.user.findFirst({
        where: { id: { in: adminIds }, isDeleted: false },
        select: { imageUrl: true }
      }) : null;

      if (creator && creator.isApproved && creator.isPrimary) {
        const effectiveImageUrl = adminData?.imageUrl || creator.user?.imageUrl || null;
        const videos = (creator.videos || []).map((v) =>
          VideoContentService.mapToPublicVideoDTO({
              ...v,
              creator: { ...creator, imageUrl: effectiveImageUrl }
          })
        );

        return {
            id: creator.id,
            name: creator.name,
            slug: creator.slug,
            imageUrl: effectiveImageUrl,
            bannerUrl: creator.bannerUrl,
            bio: creator.bio,
            userId: creator.userId,
            subscribersCount: creator.displaySubscribersCount ?? creator.subscribersCount ?? 0,
            videos
        };
      }

      if (!creator && canUseDemoFallbacks()) {
        return {
            id: DEFAULT_CREATOR.id,
            name: DEFAULT_CREATOR.name,
            slug: DEFAULT_CREATOR.slug,
            imageUrl: adminData?.imageUrl || null,
            bannerUrl: null,
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

  static async getConfiguredOrDefaultCreator(): Promise<PublicCreatorPageDTO | null> {
    const slug = MainChannelService.getConfiguredSlug();
    return this.getCreatorBySlug(slug);
  }
}
