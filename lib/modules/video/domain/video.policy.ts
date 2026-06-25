import { Prisma, AccessTier, VideoStatus } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "./video-asset.constants";

export type VideoStateBlocker = { code: string; message: string; field?: string };

type ContractVideo = {
  title?: string | null;
  slug?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  asset?: {
    isPrimary?: boolean | null;
    provider?: string | null;
    processingState?: string | null;
    providerAssetId?: string | null;
  } | null;
};

type AdminWhereFilters = {
  status?: string | null;
  tier?: string | null;
  query?: string | null;
  isMainFeatured?: string | null;
  showInSidebar?: string | null;
};

export class VideoPolicy {
  static getPublicationBlockers(video: ContractVideo): VideoStateBlocker[] {
    const blockers: VideoStateBlocker[] = [];
    if (!video.title?.trim()) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_TITLE', message: 'Podaj tytuł przed publikacją filmu.', field: 'title' });
    if (!video.slug?.trim()) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_SLUG', message: 'Podaj slug przed publikacją filmu.', field: 'slug' });
    if (!video.tier) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_TIER', message: 'Wybierz tier dostępu przed publikacją filmu.', field: 'tier' });
    if (video.status === 'ARCHIVED') blockers.push({ code: 'VIDEO_PUBLICATION_ARCHIVED', message: 'Zarchiwizowany film trzeba najpierw przywrócić do szkicu.', field: 'status' });

    const asset = video.asset;
    if (!asset) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_ASSET', message: 'Publikacja wymaga primary assetu Cloudflare Stream w stanie READY.', field: 'asset' });
    else {
      if (!asset.isPrimary) blockers.push({ code: 'VIDEO_PUBLICATION_NON_PRIMARY_ASSET', message: 'Publikacja wymaga primary assetu.', field: 'asset' });
      if (asset.provider !== VIDEO_PROVIDER.CLOUDFLARE_STREAM) blockers.push({ code: 'VIDEO_PUBLICATION_NON_CLOUDFLARE_ASSET', message: 'Primary asset musi pochodzić z Cloudflare Stream.', field: 'asset' });
      if (asset.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) blockers.push({ code: 'VIDEO_PUBLICATION_ASSET_NOT_READY', message: 'Asset Cloudflare Stream nie jest jeszcze READY.', field: 'asset' });
      if (!asset.providerAssetId) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_PROVIDER_ASSET_ID', message: 'Brakuje identyfikatora assetu Cloudflare Stream.', field: 'asset' });
    }
    return blockers;
  }

  static getHeroBlockers(video: ContractVideo): VideoStateBlocker[] {
    const blockers = this.getPublicationBlockers(video);
    if (video.status !== 'PUBLISHED') blockers.push({ code: 'VIDEO_HERO_NOT_PUBLISHED', message: 'Film Hero musi być OPUBLIKOWANY.', field: 'status' });
    if (video.tier !== 'PUBLIC') blockers.push({ code: 'VIDEO_HERO_NOT_PUBLIC', message: 'Film Hero musi być PUBLICZNY.', field: 'tier' });
    if (video.status === 'ARCHIVED') blockers.push({ code: 'VIDEO_HERO_ARCHIVED', message: 'Zarchiwizowany film nie może być filmem Hero.', field: 'status' });
    return blockers;
  }

  static canBeHero(video: ContractVideo): boolean {
    return this.getHeroBlockers(video).length === 0;
  }

  static getSidebarBlockers(video: { status: VideoStatus }): VideoStateBlocker[] {
    if (video.status === 'ARCHIVED') return [{ code: 'VIDEO_SIDEBAR_ARCHIVED', message: 'Zarchiwizowany film nie może być widoczny w panelu bocznym.', field: 'status' }];
    if (video.status !== 'PUBLISHED') return [{ code: 'VIDEO_SIDEBAR_NOT_PUBLISHED', message: 'Tylko opublikowane filmy mogą być widoczne w panelu bocznym.', field: 'status' }];
    return [];
  }

  static isOnMainChannel(video: { creatorId: string }, mainChannelId: string): boolean {
    return video.creatorId === mainChannelId;
  }

  static isPubliclyVisible(video: { status: VideoStatus; publishedAt: Date | null }, now: Date): boolean {
    if (video.status !== 'PUBLISHED') return false;
    if (!video.publishedAt) return false;
    return video.publishedAt <= now;
  }

  static buildPublicWhere(mainChannelId: string, now: Date): Prisma.VideoWhereInput {
    return {
      creatorId: mainChannelId,
      status: 'PUBLISHED',
      publishedAt: { lte: now }
    };
  }

  static buildAdminWhere(mainChannelId: string, filters: AdminWhereFilters): Prisma.VideoWhereInput {
    const where: Prisma.VideoWhereInput = { creatorId: mainChannelId };

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status as VideoStatus;
    }
    if (filters.tier && filters.tier !== 'ALL') {
      where.tier = filters.tier as AccessTier;
    }
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { slug: { contains: filters.query, mode: 'insensitive' } }
      ];
    }
    if (filters.isMainFeatured === 'true') where.isMainFeatured = true;
    if (filters.isMainFeatured === 'false') where.isMainFeatured = false;

    if (filters.showInSidebar === 'true') where.showInSidebar = true;
    if (filters.showInSidebar === 'false') where.showInSidebar = false;

    return where;
  }
}
