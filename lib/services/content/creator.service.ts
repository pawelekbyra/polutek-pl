import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from '@/lib/data/initial-content';
import { PublicCreatorPageDTO } from '@/app/types/video';
import { canUseDemoFallbacks, flags } from '@/lib/feature-flags';
import { getAdminClerkUserIds } from '@/lib/admin-config';
import { VideoContentService, publicVideoOrderBy } from './video.service';

export class CreatorContentService {
  static async getCreatorBySlug(slug: string): Promise<PublicCreatorPageDTO | null> {
    const mainCreatorSlug = flags.mainCreatorSlug;
    const isMainCreator = slug === mainCreatorSlug;

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

      if (isMainCreator && creator) {
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
            subscribersCount: creator.subscribersCount || 0,
            videos
        };
      }

      if (!creator && isMainCreator && canUseDemoFallbacks()) {
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
          videos: (creator.videos || []).map((v) => VideoContentService.mapToPublicVideoDTO({ ...v, creator }))
      };
    } catch (e: unknown) {
      console.error("[GET_CREATOR_BY_SLUG_ERROR]", e);
      if (isMainCreator && canUseDemoFallbacks()) {
        return {
            ...DEFAULT_CREATOR,
            imageUrl: null,
            videos: INITIAL_VIDEOS.map(v => VideoContentService.mapToPublicVideoDTO(v))
        };
      }
      throw e;
    }
  }

  static async getConfiguredOrDefaultCreator(): Promise<PublicCreatorPageDTO | null> {
    if (flags.mainCreatorSlug) {
      const configuredCreator = await this.getCreatorBySlug(flags.mainCreatorSlug);
      if (configuredCreator) return configuredCreator;
    }

    try {
      const creator = await prisma.creator.findFirst({
        where: { isApproved: true },
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
        },
        orderBy: [
          { isPrimary: 'desc' },
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      if (!creator) return null;

      const adminIds = getAdminClerkUserIds();
      const adminData = (creator.isPrimary && adminIds.length > 0) ? await prisma.user.findFirst({
        where: { id: { in: adminIds }, isDeleted: false },
        select: { imageUrl: true }
      }) : null;

      const imageUrl = adminData?.imageUrl || creator.user?.imageUrl || null;

      return {
        id: creator.id,
        name: creator.name,
        slug: creator.slug,
        imageUrl,
        bannerUrl: creator.bannerUrl,
        bio: creator.bio,
        userId: creator.userId,
        subscribersCount: creator.subscribersCount || 0,
        videos: (creator.videos || []).map((v) => VideoContentService.mapToPublicVideoDTO({ ...v, creator: { ...creator, imageUrl } })),
      };
    } catch (e: unknown) {
      console.error("[GET_CONFIGURED_OR_DEFAULT_CREATOR_ERROR]", e);
      if (canUseDemoFallbacks()) {
        return {
          id: DEFAULT_CREATOR.id,
          name: DEFAULT_CREATOR.name,
          slug: DEFAULT_CREATOR.slug,
          imageUrl: null,
          bannerUrl: null,
          bio: DEFAULT_CREATOR.bio,
          userId: undefined,
          subscribersCount: 1250000,
          videos: INITIAL_VIDEOS.map(v => VideoContentService.mapToPublicVideoDTO(v)),
        };
      }
      throw e;
    }
  }
}
