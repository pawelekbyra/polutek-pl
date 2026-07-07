import { Prisma, AccessTier, VideoStatus } from "@prisma/client";
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
      providerAssetId?: string | null;
      externalVideoId?: string | null;
    } | null;
  } | null;
  asset?: {
    isPrimary?: boolean | null;
    provider?: string | null;
    processingState?: string | null;
    providerAssetId?: string | null;
    externalVideoId?: string | null;
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
  'VIDEO_PUBLICATION_MISSING_YOUTUBE_VIDEO_ID',
  'VIDEO_PUBLICATION_YOUTUBE_PATRON_FORBIDDEN',
  'VIDEO_PUBLICATION_MISSING_VIMEO_VIDEO_ID',
  'VIDEO_PUBLICATION_VIMEO_PATRON_FORBIDDEN',
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
    // publication is attempted (VideoPlaybackRouteService.activateFirstReadyAssetIfNoneActive
    // runs at every provider-webhook chokepoint).
    const routeAsset = video.activePlaybackRoute?.asset ?? null;
    if (!routeAsset) {
      blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE', message: 'Publikacja wymaga aktywnego źródła odtwarzania w stanie READY.', field: 'activePlaybackRoute' });
      return blockers;
    }

    const asset = routeAsset;
    const isYoutube = asset.provider === VIDEO_PROVIDER.YOUTUBE;
    const isVimeo = asset.provider === VIDEO_PROVIDER.VIMEO;
    const isCfStream = asset.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM;
    const isMux = asset.provider === VIDEO_PROVIDER.MUX;

    if (!isCfStream && !isMux && !isYoutube && !isVimeo) {
      blockers.push({ code: 'VIDEO_PUBLICATION_NON_PLAYABLE_PROVIDER', message: 'Aktywne źródło musi pochodzić z Cloudflare Stream, Mux, YouTube lub Vimeo.', field: 'activePlaybackRoute' });
    }

    if (isCfStream) {
      if (asset.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) blockers.push({ code: 'VIDEO_PUBLICATION_ASSET_NOT_READY', message: 'Aktywne źródło Cloudflare Stream nie jest jeszcze gotowe.', field: 'activePlaybackRoute' });
      if (!asset.providerAssetId) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_PROVIDER_ASSET_ID', message: 'Brakuje identyfikatora aktywnego źródła Cloudflare Stream.', field: 'activePlaybackRoute' });
    }

    if (isMux) {
      if (asset.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) blockers.push({ code: 'VIDEO_PUBLICATION_ASSET_NOT_READY', message: 'Aktywne źródło Mux nie jest jeszcze gotowe.', field: 'activePlaybackRoute' });
      if (!asset.providerAssetId) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_PROVIDER_ASSET_ID', message: 'Brakuje identyfikatora aktywnego źródła Mux.', field: 'activePlaybackRoute' });
    }

    if (isYoutube) {
      if (video.tier === 'PATRON') blockers.push({ code: 'VIDEO_PUBLICATION_YOUTUBE_PATRON_FORBIDDEN', message: 'YouTube nie może być aktywnym źródłem dla filmów PATRON.', field: 'activePlaybackRoute' });
      if (!asset.externalVideoId) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_YOUTUBE_VIDEO_ID', message: 'Brakuje identyfikatora aktywnego źródła YouTube.', field: 'activePlaybackRoute' });
    }

    if (isVimeo) {
      if (video.tier === 'PATRON') blockers.push({ code: 'VIDEO_PUBLICATION_VIMEO_PATRON_FORBIDDEN', message: 'Vimeo nie może być aktywnym źródłem dla filmów PATRON — brak bezpiecznego prywatnego playbacku.', field: 'activePlaybackRoute' });
      if (!asset.externalVideoId) blockers.push({ code: 'VIDEO_PUBLICATION_MISSING_VIMEO_VIDEO_ID', message: 'Brakuje identyfikatora aktywnego źródła Vimeo.', field: 'activePlaybackRoute' });
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
