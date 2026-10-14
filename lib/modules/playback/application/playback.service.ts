// Playback plans: own HLS (SELF_HLS) is the only video source (CLAUDE.md 4.17).
import { checkVideoAccess } from '@/lib/modules/access';
import type { PlaybackAssetContract, PlaybackPlan, PlaybackPlanStatus } from '../domain/playback.dto';
import { AppContext } from '@/lib/modules/shared/app-context';
import { getPrimaryPlayableAsset } from '../domain/primary-playable-asset';
import { selectPrimaryVideoAsset } from '@/lib/modules/video';
import { isUpcomingPremiere, toPremiereDate } from '@/lib/modules/video/domain/premiere';
import { resolvePublicThumbnailSrc } from '@/lib/modules/media';
import { VideoStatus, type VideoAsset } from '@prisma/client';
import { buildSelfHlsPlan } from './self-hls-plan';
import { assetSizeToNumber } from '@/lib/modules/video';
import { SelfHlsTokenService } from '../infrastructure/self-hls-token.service';

export type PlaybackErrorCode =
  | "VIDEO_NOT_FOUND"
  | "VIDEO_ARCHIVED"
  | "VIDEO_NOT_PUBLISHED"
  | "LOGIN_REQUIRED"
  | "VIDEO_SOURCE_MISSING"
  | "VIDEO_SOURCE_NOT_ALLOWED"
  | "UNKNOWN_PLAYBACK_ERROR";

type VideoWithAssets = Awaited<ReturnType<AppContext['prisma']['video']['findUnique']>> & {
  assets?: VideoAsset[] | null;
  asset?: VideoAsset | null;
  activePlaybackRoute?: { asset?: VideoAsset | null } | null;
};

type PlayerDefaults = Pick<PlaybackPlan, 'player' | 'tracking'>;

const SELF_HLS_PROVIDER = 'SELF_HLS';

function emptyPlaybackRuntime(): PlayerDefaults['tracking'] {
  return { playbackSessionId: '', heartbeatIntervalSeconds: 0 };
}

// Only draft/unpublished admin previews are excluded from view counts — once a
// video is PUBLISHED, the admin's own genuine watches count like anyone else's.
function isAdminPreviewSession(
  actorType: string,
  videoStatus: VideoStatus | string | null | undefined,
  premiereAt?: Date | string | null,
): boolean {
  if (actorType !== 'admin') return false;
  // A published video whose premiere hasn't happened yet is still a preview.
  // UNLISTED is a live video reachable by link: the admin's watches count like anyone else's.
  const live = videoStatus === VideoStatus.PUBLISHED || videoStatus === VideoStatus.UNLISTED;
  return !live || isUpcomingPremiere({ status: videoStatus, premiereAt });
}

// Poster goes to the browser: public R2 copy or the thumbnail proxy, never a private storage URL.
function posterFor(video?: { id: string; status?: string | null; thumbnailUrl?: string | null; thumbnailPublicUrl?: string | null } | null): string {
  return video?.id ? resolvePublicThumbnailSrc(video, process.env) : '';
}

/** A WebVTT URL the browser may load: absolute https or a same-site path. Anything else is dropped. */
function safeSubtitleUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function playerFor(video?: { thumbnailUrl?: string | null; title?: string | null; subtitleUrlPl?: string | null; subtitleUrlEn?: string | null } | null, controls = false): PlayerDefaults['player'] {
  const textTracks: PlayerDefaults['player']['textTracks'] = [];
  const pl = safeSubtitleUrl(video?.subtitleUrlPl);
  const en = safeSubtitleUrl(video?.subtitleUrlEn);
  if (pl) textTracks.push({ src: pl, label: 'Polski', language: 'pl', kind: 'subtitles' });
  if (en) textTracks.push({ src: en, label: 'English', language: 'en', kind: 'subtitles' });
  return {
    autoplayAllowed: controls,
    mutedAutoplay: controls,
    controls,
    poster: video?.thumbnailUrl || '',
    title: video?.title || '',
    ...(textTracks.length > 0 ? { textTracks } : {}),
  };
}

function toStatus(reason?: string): PlaybackPlanStatus {
  if (reason === 'LOGIN_REQUIRED') return 'LOGIN_REQUIRED';
  if (reason === 'NOT_FOUND' || reason === 'VIDEO_NOT_FOUND') return 'UNAVAILABLE';
  return 'ERROR';
}

function toSafeAssetContract(asset: VideoAsset | null | undefined): PlaybackAssetContract | undefined {
  if (!asset) return undefined;

  return {
    provider: asset.provider,
    processingState: asset.processingState,
    isPrimary: Boolean(asset.isPrimary),
    // Public playback plans intentionally redact storage identifiers. Even
    // denied/non-ready states may include diagnostics.asset for safe state
    // messaging, so never expose object keys or provider ids here.
    mimeType: asset.mimeType ?? null,
    sizeBytes: assetSizeToNumber(asset.sizeBytes),
  };
}

function unavailablePlan(args: {
  videoId: string;
  status: PlaybackPlanStatus;
  video?: { thumbnailUrl?: string | null; title?: string | null } | null;
  accessAllowed?: boolean;
  accessReason?: string;
  requiredTier?: string;
  warnings: string[];
  sourceConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  providerResolutionAllowed?: boolean;
  sourceMode?: 'PROVIDER_ASSET' | 'LEGACY_URL' | 'NONE';
  asset?: PlaybackAssetContract;
  providerResolutionAttempted?: boolean;
}): PlaybackPlan {
  return {
    videoId: args.videoId,
    status: args.status,
    canPlay: false,
    access: {
      allowed: args.accessAllowed ?? false,
      reason: args.accessReason,
      requiredTier: args.requiredTier,
    },
    source: undefined,
    player: playerFor(args.video, false),
    diagnostics: {
      warnings: args.warnings,
      sourceConfidence: args.sourceConfidence ?? 'LOW',
      providerResolutionAllowed: args.providerResolutionAllowed ?? false,
      providerResolutionAttempted: args.providerResolutionAttempted ?? false,
      sourceMode: args.sourceMode ?? 'NONE',
      asset: args.asset,
    },
    tracking: emptyPlaybackRuntime(),
  };
}

/**
 * The asset that plays: the active route's asset when it is READY own HLS, else the
 * primary/newest own-HLS asset. Rows of any other provider (legacy Mux/Stream/YouTube/
 * Vimeo/storage rows that still sit in the DB as inactive legacy rows) are ignored.
 */
function pickSelfHlsAsset(video: VideoWithAssets | null): VideoAsset | null {
  const routeAsset = video?.activePlaybackRoute?.asset;
  if (routeAsset?.provider === SELF_HLS_PROVIDER && routeAsset.processingState === 'READY') return routeAsset;
  const own = [...(video?.assets ?? []), ...(video?.asset ? [video.asset] : [])].filter((a) => a.provider === SELF_HLS_PROVIDER);
  return selectPrimaryVideoAsset(own);
}

export class PlaybackService {
  /**
   * `options.reuseSessionId`: the open player renews its delivery token. Access and the premiere
   * gate are checked again in full; only the playback session may be kept (see self-hls-plan).
   */
  static async createPlaybackPlanWithContext(
    videoId: string,
    ctx: AppContext,
    ipHash?: string,
    userAgentHash?: string,
    options: { reuseSessionId?: string } = {},
  ): Promise<PlaybackPlan> {
    const { actor } = ctx;

    // Provider-gating order: make the backend access decision first, then load the
    // row that decision was about (the caller may have passed a slug) before
    // inspecting or resolving any playable source.
    const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);
    const resolvedVideoId = (accessResult.ok && accessResult.data.videoId) || videoId;

    const video = await ctx.prisma.video.findUnique({
      where: { id: resolvedVideoId },
      include: {
        assets: true,
        activePlaybackRoute: { include: { asset: true } },
      }
    }) as VideoWithAssets;

    if (!accessResult.ok) {
        return unavailablePlan({
            videoId,
            status: 'ERROR',
            video: { thumbnailUrl: posterFor(video), title: video?.title },
            accessReason: 'FORBIDDEN',
            warnings: ['Internal error during access check'],
        });
    }

    // Scheduled premiere gate (CLAUDE.md "Premieres"). Runs before any source,
    // token, provider id or playback session is touched, so an upcoming video
    // can never be played or counted early — whatever its tier. Admins may
    // still preview it (like a draft); their sessions are marked as previews.
    // The decision's own premiereAt (computed for the row it resolved, id or slug) and the loaded row
    // are both checked, so neither a slug nor a stale decision can open a premiere early (SEC-10).
    const upcomingPremiereAt = actor.type === 'admin'
      ? null
      : toPremiereDate(accessResult.data.premiereAt) ?? (isUpcomingPremiere(video) ? toPremiereDate(video?.premiereAt) : null);
    if (upcomingPremiereAt) {
      const isGuest = actor.type === 'guest';
      return {
        ...unavailablePlan({
          videoId,
          status: isGuest ? 'LOGIN_REQUIRED' : 'COMING_SOON',
          video: { thumbnailUrl: posterFor(video), title: video?.title },
          accessReason: isGuest ? 'LOGIN_REQUIRED' : 'COMING_SOON',
          warnings: ['Premiere not reached yet'],
        }),
        ...(isGuest ? {} : { premiereAt: upcomingPremiereAt.toISOString() }),
      };
    }

    const decision = accessResult.data;

    if (!video && !decision.hasAccess && decision.reason === 'NOT_FOUND') {
      return unavailablePlan({
        videoId,
        status: 'UNAVAILABLE',
        accessReason: 'VIDEO_NOT_FOUND',
        warnings: ['Video not found'],
      });
    }

    if (!decision.hasAccess) {
        return unavailablePlan({
            videoId,
            status: toStatus(decision.reason),
            video: { thumbnailUrl: posterFor(video), title: video?.title },
            accessReason: decision.reason as string | undefined,
            requiredTier: decision.requiredTier,
            warnings: [decision.reason || 'Access denied'],
        });
    }

    // At this point decision.hasAccess is true. Only now may playback-source
    // metadata be inspected or a delivery token be issued.
    if (!video) {
      return unavailablePlan({
        videoId,
        status: 'UNAVAILABLE',
        accessAllowed: true,
        accessReason: 'VIDEO_NOT_FOUND',
        warnings: ['Video not found'],
      });
    }

    const thumbnailUrl = posterFor(video);
    const title = video.title || '';
    const tier = video.tier || 'PUBLIC';

    const asset = pickSelfHlsAsset(video);
    if (!asset) {
      return unavailablePlan({
        videoId,
        status: 'NO_PRIMARY_ASSET',
        video: { thumbnailUrl, title },
        accessAllowed: true,
        warnings: ['No own HLS video asset is available'],
        sourceMode: 'NONE',
      });
    }

    const safeAsset = toSafeAssetContract(asset);
    const legacyRouteWarning = video.activePlaybackRoute?.asset?.id !== asset.id && asset.processingState === 'READY'
      ? 'No active playback route found; using primary asset selection.'
      : null;
    const warnings = legacyRouteWarning ? [legacyRouteWarning] : [];

    const primaryAsset = getPrimaryPlayableAsset(asset);
    if (!primaryAsset.canResolveProviderSource) {
      return unavailablePlan({
        videoId,
        status: primaryAsset.state === 'FAILED' ? 'UNAVAILABLE' : primaryAsset.state,
        video: { thumbnailUrl, title },
        accessAllowed: true,
        warnings: [...warnings, ...primaryAsset.warnings],
        sourceMode: 'PROVIDER_ASSET',
        asset: safeAsset,
      });
    }

    if (!SelfHlsTokenService.isConfigured()) {
      return unavailablePlan({
        videoId,
        status: 'ERROR',
        video: { thumbnailUrl, title },
        accessAllowed: true,
        warnings: [...warnings, 'Own HLS signing is not configured'],
        providerResolutionAllowed: true,
        providerResolutionAttempted: true,
        sourceMode: 'PROVIDER_ASSET',
        asset: safeAsset,
      });
    }

    const plan = await buildSelfHlsPlan({
      ctx,
      videoId,
      asset,
      tier,
      thumbnailUrl,
      isAdminPreview: isAdminPreviewSession(actor.type, video.status, video.premiereAt),
      ipHash,
      userAgentHash,
      safeAsset,
      // Subtitles only on the playable plan: denied plans are built without them (no URL leaks).
      player: playerFor({ thumbnailUrl, title, subtitleUrlPl: video.subtitleUrlPl, subtitleUrlEn: video.subtitleUrlEn }, true),
      warnings,
      reuseSessionId: options.reuseSessionId,
    }).catch((e) => {
      console.error('[PLAYBACK_SERVICE] SELF_HLS resolution failed', e);
      return null;
    });
    if (plan) return plan;

    return unavailablePlan({
      videoId,
      status: 'ERROR',
      video: { thumbnailUrl, title },
      accessAllowed: true,
      warnings: [...warnings, 'Failed to resolve own HLS playback source'],
      providerResolutionAllowed: true,
      providerResolutionAttempted: true,
      sourceMode: 'PROVIDER_ASSET',
      asset: safeAsset,
    });
  }
}
