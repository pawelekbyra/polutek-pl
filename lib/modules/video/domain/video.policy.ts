import { Prisma, AccessTier, VideoStatus } from "@prisma/client";
import { accessTierWhere, toVideoAccessTier } from "@/lib/access-tier";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "./video-asset.constants";

export type VideoStateBlocker = { code: string; message: string; field?: string };

type ContractVideo = {
  title?: string | null;
  slug?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  activePlaybackRoute?: {
    asset?: {
      provider?: string | null;
      processingState?: string | null;
      objectKey?: string | null;
    } | null;
  } | null;
  asset?: {
    isPrimary?: boolean | null;
    provider?: string | null;
    processingState?: string | null;
  } | null;
};

type AdminWhereFilters = {
  status?: string | null;
  tier?: string | null;
  query?: string | null;
  isMainFeatured?: string | null;
  showInSidebar?: string | null;
};

// Blocker codes from getPublicationBlockers() that are purely about the playback route not
// being ready *yet* (no active route selected yet, provider still processing, provider
// identifiers not synced yet). Auto-publish (publish-after-asset-ready.use-case.ts) treats
// these as "keep waiting, don't record an error" while any other blocker (missing
// title/slug/tier, archived status) is a real, structural problem worth surfacing. Keeping
// this list next to getPublicationBlockers() ensures it stays in sync with the actual codes.
export const ASSET_READINESS_BLOCKER_CODES = new Set<string>([
  'VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE',
  'VIDEO_PUBLICATION_NON_PLAYABLE_PROVIDER',
  'VIDEO_PUBLICATION_ASSET_NOT_READY',
  'VIDEO_PUBLICATION_MISSING_PROVIDER_ASSET_ID',
]);

export class VideoPolicy {
  static isAssetReadinessBlocker(code: string): boolean {
    return ASSET_READINESS_BLOCKER_CODES.has(code);
  }

  static getPublicationBlockers(video: ContractVideo): VideoStateBlocker[] {
    const blockers: VideoStateBlocker[] = [];
    if (!video.title?.trim()) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_TITLE', message: 'Podaj tytuł przed publikacją filmu.', field: 'title' });
    if (!video.slug?.trim()) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_SLUG', message: 'Podaj slug przed publikacją filmu.', field: 'slug' });
    if (!video.tier) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_TIER', message: 'Wybierz tier dostępu przed publikacją filmu.', field: 'tier' });
    if (video.status === 'ARCHIVED') blockers.push({ code: 'VIDEO_PUBLICATION_ARCHIVED', message: 'Zarchiwizowany film trzeba najpierw przywrócić do szkicu.', field: 'status' });

    // The active playback route is the sole source of truth for "what plays" (see
    // VideoPlaybackRouteService). A legacy isPrimary asset without a route is *not*
    // sufficient to publish — it should have been backfilled into a route by the time
    // publication is attempted (the encode worker activates the route when it finishes).
    const routeAsset = video.activePlaybackRoute?.asset ?? null;
    if (!routeAsset) {
      blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE', message: 'Publikacja wymaga aktywnego źródła odtwarzania w stanie READY.', field: 'activePlaybackRoute' });
      return blockers;
    }

    // Own HLS is the only supported source: the encode worker creates the asset READY
    // only after every object is verified in R2.
    const asset = routeAsset;
    if (asset.provider !== VIDEO_PROVIDER.SELF_HLS) {
      blockers.push({ code: 'VIDEO_PUBLICATION_NON_PLAYABLE_PROVIDER', message: 'Aktywne źródło musi pochodzić z własnego HLS (wgraj plik w zakładce Media).', field: 'activePlaybackRoute' });
      return blockers;
    }
    if (asset.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) blockers.push({ code: 'VIDEO_PUBLICATION_ASSET_NOT_READY', message: 'Wideo jest jeszcze kodowane albo kodowanie się nie powiodło.', field: 'activePlaybackRoute' });
    if (!asset.objectKey) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_PROVIDER_ASSET_ID', message: 'Brakuje klucza obiektu własnego HLS.', field: 'activePlaybackRoute' });
    return blockers;
  }

  static getHeroBlockers(video: ContractVideo): VideoStateBlocker[] {
    const blockers = this.getPublicationBlockers(video);
    if (video.status !== 'PUBLISHED') blockers.push({ code: 'VIDEO_HERO_NOT_PUBLISHED', message: 'Film Hero musi być OPUBLIKOWANY.', field: 'status' });
    if (toVideoAccessTier(video.tier) !== 'PUBLIC') blockers.push({ code: 'VIDEO_HERO_NOT_PUBLIC', message: 'Film Hero musi być PUBLICZNY.', field: 'tier' });
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
    const tierWhere = accessTierWhere(filters.tier);
    if (tierWhere) where.tier = tierWhere;
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
