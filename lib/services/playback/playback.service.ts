// R6/R3 delivery: Playback now uses modular access.
import { checkVideoAccess } from '@/lib/modules/access';
import { getVideoSourceInfo } from '@/lib/media/video-source';
import { isAllowedVideoSourceUrl } from '@/lib/blob';
import { StorageService } from '../storage/storage.service';
import type { PlaybackAssetContract, PlaybackPlan, PlaybackPlanStatus } from './playback.dto';
import { AppContext } from '@/lib/modules/shared/app-context';
import { MediaPolicy } from '@/lib/modules/media';
import { shouldBlockLegacyPrivatePlaybackFallback } from './legacy-private-fallback.policy';
import { CloudflareStreamClient } from '@/lib/modules/video/infrastructure/cloudflare-stream.client';

export type PlaybackErrorCode =
  | "VIDEO_NOT_FOUND"
  | "VIDEO_ARCHIVED"
  | "VIDEO_NOT_PUBLISHED"
  | "LOGIN_REQUIRED"
  | "PATRON_REQUIRED"
  | "VIDEO_SOURCE_MISSING"
  | "VIDEO_SOURCE_NOT_ALLOWED"
  | "UNKNOWN_PLAYBACK_ERROR";

type VideoWithAsset = Awaited<ReturnType<AppContext['prisma']['video']['findUnique']>>;

type PlayerDefaults = Pick<PlaybackPlan, 'player' | 'tracking'>;

const PROVIDER_BACKED_PLAYBACK_PROVIDERS = new Set(['CLOUDFLARE_STREAM', 'MUX']);
const LEGACY_STORAGE_PROVIDERS = new Set(['R2', 'S3', 'VERCEL_BLOB']);

function emptyPlaybackRuntime(): PlayerDefaults['tracking'] {
  return { playbackSessionId: '', heartbeatIntervalSeconds: 0 };
}

function playerFor(video?: { thumbnailUrl?: string | null; title?: string | null } | null, controls = false): PlayerDefaults['player'] {
  return {
    autoplayAllowed: controls,
    mutedAutoplay: controls,
    controls,
    poster: video?.thumbnailUrl || '',
    title: video?.title || '',
  };
}

function toStatus(reason?: string): PlaybackPlanStatus {
  if (reason === 'LOGIN_REQUIRED') return 'LOGIN_REQUIRED';
  if (reason === 'PATRON_REQUIRED') return 'PATRON_REQUIRED';
  if (reason === 'NOT_FOUND' || reason === 'VIDEO_NOT_FOUND') return 'UNAVAILABLE';
  return 'ERROR';
}

function toSafeAssetContract(asset: any): PlaybackAssetContract | undefined {
  if (!asset) return undefined;

  return {
    provider: asset.provider,
    processingState: asset.processingState,
    isPrimary: Boolean(asset.isPrimary),
    // Public playback plans intentionally redact provider identifiers. Even
    // denied/non-ready states may include diagnostics.asset for safe state
    // messaging, so never expose private Cloudflare/Mux asset IDs here.
    providerAssetId: null,
    providerPlaybackId: null,
    mimeType: asset.mimeType ?? null,
    sizeBytes: asset.sizeBytes ?? null,
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

export class PlaybackService {
  static async createPlaybackPlanWithContext(videoId: string, ctx: AppContext, ipHash?: string, userAgentHash?: string): Promise<PlaybackPlan> {
    const { prisma, actor } = ctx;

    // Provider-gating order: load safe video metadata first, then make the
    // backend access decision before inspecting or resolving any playable source.
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        asset: true,
      }
    }) as VideoWithAsset & { asset?: any };

    const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);

    if (!accessResult.ok) {
        return unavailablePlan({
            videoId,
            status: 'ERROR',
            video,
            accessReason: 'FORBIDDEN',
            warnings: ['Internal error during access check'],
        });
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
            video,
            accessReason: decision.reason as any,
            requiredTier: decision.requiredTier,
            warnings: [decision.reason || 'Access denied'],
        });
    }

    // At this point decision.hasAccess is true. Only now may playback-source
    // metadata be inspected or future provider resolution be permitted.
    let videoUrl = video?.videoUrl;
    let thumbnailUrl = video?.thumbnailUrl || '';
    let title = video?.title || '';
    let tier = video?.tier || 'PUBLIC';

    if (!video && decision.hasAccess) {
        const { INITIAL_VIDEOS } = await import('@/lib/data/initial-content');
        const fallback = INITIAL_VIDEOS.find(v => v.id === videoId || v.slug === videoId);
        if (fallback) {
            videoUrl = fallback.videoUrl;
            thumbnailUrl = fallback.thumbnailUrl || '';
            title = fallback.title;
            tier = fallback.tier as any;
        }
    }

    const asset = video?.asset;
    const safeAsset = toSafeAssetContract(asset);

    if (asset) {
      if (!asset.isPrimary) {
        return unavailablePlan({
          videoId,
          status: 'NO_PRIMARY_ASSET',
          video: { thumbnailUrl, title },
          accessAllowed: true,
          warnings: ['No primary video asset is available'],
          sourceMode: 'PROVIDER_ASSET',
          asset: safeAsset,
        });
      }

      if (asset.processingState === 'PENDING' || asset.processingState === 'UPLOADING' || asset.processingState === 'PROCESSING') {
        return unavailablePlan({
          videoId,
          status: 'PROCESSING',
          video: { thumbnailUrl, title },
          accessAllowed: true,
          warnings: [`Video asset is ${asset.processingState}`],
          sourceMode: 'PROVIDER_ASSET',
          asset: safeAsset,
        });
      }

      if (asset.processingState === 'FAILED') {
        return unavailablePlan({
          videoId,
          status: 'UNAVAILABLE',
          video: { thumbnailUrl, title },
          accessAllowed: true,
          warnings: ['Video asset processing failed'],
          sourceMode: 'PROVIDER_ASSET',
          asset: safeAsset,
        });
      }

      if (asset.processingState !== 'READY') {
        return unavailablePlan({
          videoId,
          status: 'VIDEO_NOT_READY',
          video: { thumbnailUrl, title },
          accessAllowed: true,
          warnings: ['Video asset is not ready'],
          sourceMode: 'PROVIDER_ASSET',
          asset: safeAsset,
        });
      }

      if (asset.provider === 'CLOUDFLARE_STREAM') {
        try {
            const cfClient = new CloudflareStreamClient();
            const providerId = asset.providerPlaybackId || asset.providerAssetId;

            if (!providerId) {
                throw new Error('Cloudflare asset missing provider identifiers');
            }

            const { token } = await cfClient.createSignedPlaybackToken(providerId);

            // Using the generic videodelivery.net domain which is official for Cloudflare Stream
            const playbackUrl = `https://iframe.videodelivery.net/${token}`;

            const isAdminPreview = actor.type === 'admin';

            // Create a session only after successful resolution
            const session = await prisma.videoPlaybackSession.create({
                data: {
                    videoId,
                    userId: actor.type === 'user' ? actor.userId : (actor.type === 'admin' ? actor.userId : null),
                    ipHash,
                    userAgentHash,
                    sourceKind: 'cloudflare_stream',
                    accessTier: tier as any,
                    isAdminPreview: isAdminPreview
                }
            });

            return {
                videoId,
                status: 'READY',
                canPlay: true,
                access: { allowed: true },
                source: {
                    provider: 'CLOUDFLARE_STREAM',
                    kind: 'cloudflare_stream',
                    playbackUrl: playbackUrl,
                    embedUrl: playbackUrl,
                    posterUrl: thumbnailUrl,
                    mimeType: asset.mimeType ?? undefined,
                    needsProxy: false,
                    isExternalEmbed: true,
                    isSignedUrl: true,
                    asset: safeAsset,
                },
                player: playerFor({ thumbnailUrl, title }, true),
                diagnostics: {
                    warnings: [],
                    sourceConfidence: 'HIGH',
                    providerResolutionAllowed: true,
                    providerResolutionAttempted: true,
                    sourceMode: 'PROVIDER_ASSET',
                    asset: safeAsset,
                },
                tracking: {
                    playbackSessionId: session.id,
                    heartbeatIntervalSeconds: 15
                }
            };
        } catch (e) {
            console.error('[PLAYBACK_SERVICE] Cloudflare resolution failed', e);
            return unavailablePlan({
                videoId,
                status: 'READY',
                video: { thumbnailUrl, title },
                accessAllowed: true,
                warnings: ['Failed to resolve secure playback source'],
                providerResolutionAllowed: true,
                providerResolutionAttempted: true,
                sourceMode: 'PROVIDER_ASSET',
                asset: safeAsset,
            });
        }
      }

      if (PROVIDER_BACKED_PLAYBACK_PROVIDERS.has(asset.provider)) {
        return {
          videoId,
          status: 'READY',
          canPlay: false,
          access: { allowed: true },
          source: {
            provider: asset.provider,
            kind: String(asset.provider).toLowerCase(),
            posterUrl: thumbnailUrl,
            mimeType: asset.mimeType ?? undefined,
            needsProxy: false,
            isExternalEmbed: false,
            isSignedUrl: false,
            asset: safeAsset,
          },
          player: playerFor({ thumbnailUrl, title }, false),
          diagnostics: {
            warnings: ['Provider-backed playback resolution is gated and not implemented in this ticket'],
            sourceConfidence: 'MEDIUM',
            providerResolutionAllowed: true,
            providerResolutionAttempted: false,
            sourceMode: 'PROVIDER_ASSET',
            asset: safeAsset,
          },
          tracking: emptyPlaybackRuntime(),
        };
      }
    }

    if (shouldBlockLegacyPrivatePlaybackFallback({ tier, asset })) {
        return unavailablePlan({
          videoId,
          status: 'NO_PRIMARY_ASSET',
          video: { thumbnailUrl, title },
          accessAllowed: true,
          warnings: ['Patron-only legacy playback fallback is disabled until a READY provider-backed asset is available'],
          sourceMode: asset ? 'PROVIDER_ASSET' : 'LEGACY_URL',
          asset: safeAsset,
        });
    }

    if (!videoUrl) {
        return unavailablePlan({
          videoId,
          status: 'NO_PRIMARY_ASSET',
          video: { thumbnailUrl, title },
          accessAllowed: true,
          warnings: asset ? ['No playable legacy source for this asset'] : ['No primary or legacy video asset is available'],
          sourceMode: asset ? 'PROVIDER_ASSET' : 'LEGACY_URL',
          asset: safeAsset,
        });
    }

    if (!isAllowedVideoSourceUrl(videoUrl)) {
        return unavailablePlan({
          videoId,
          status: 'UNAVAILABLE',
          video: { thumbnailUrl, title },
          accessAllowed: true,
          warnings: ['Video URL not allowed'],
          sourceMode: 'LEGACY_URL',
          asset: safeAsset,
        });
    }

    let sourceUrl = videoUrl;
    let isSignedUrl = false;
    let expiresAt: string | undefined = undefined;

    if (asset && LEGACY_STORAGE_PROVIDERS.has(asset.provider)) {
        try {
            const signedData = await StorageService.getPresignedUrl(
                asset.provider,
                asset.bucket || process.env.R2_BUCKET_NAME || '',
                asset.objectKey,
                900
            );
            sourceUrl = signedData.url;
            isSignedUrl = true;
            expiresAt = signedData.expiresAt.toISOString();
        } catch (e) {
            console.error('[PLAYBACK_SERVICE] Failed to sign URL', e);
        }
    }

    const sourceInfo = getVideoSourceInfo(sourceUrl, `/api/media/${videoId}`);

    // Leak safety: ensure playbackUrl is redacted if it's a raw URL
    if (MediaPolicy.isProbablyRawMediaUrl(sourceInfo.playbackUrl) && !sourceInfo.playbackUrl.startsWith('/api/media/')) {
        sourceInfo.playbackUrl = `/api/media/${videoId}`;
    }

    const isAdminPreview = actor.type === 'admin';

    // Create sessions only for a concrete playable legacy/embed plan. Denied,
    // not-ready, and provider-placeholder plans never get sessions and therefore
    // cannot count playback/view events.
    const session = await prisma.videoPlaybackSession.create({
        data: {
            videoId,
            userId: actor.type === 'user' ? actor.userId : (actor.type === 'admin' ? actor.userId : null),
            ipHash,
            userAgentHash,
            sourceKind: sourceInfo.kind,
            accessTier: tier as any,
            isAdminPreview: isAdminPreview
        }
    });

    return {
        videoId,
        status: 'READY',
        canPlay: true,
        access: { allowed: true },
        source: {
            provider: asset?.provider || sourceInfo.kind,
            kind: sourceInfo.kind,
            playbackUrl: sourceInfo.playbackUrl,
            embedUrl: sourceInfo.embedUrl,
            posterUrl: thumbnailUrl,
            needsProxy: sourceInfo.needsProxy,
            isExternalEmbed: sourceInfo.kind === 'youtube' || sourceInfo.kind === 'vimeo',
            isSignedUrl,
            expiresAt,
            asset: safeAsset,
        },
        player: playerFor({ thumbnailUrl, title }, true),
        diagnostics: {
            warnings: [],
            sourceConfidence: 'HIGH',
            providerResolutionAllowed: false,
            providerResolutionAttempted: false,
            sourceMode: 'LEGACY_URL',
            asset: safeAsset,
        },
        tracking: {
            playbackSessionId: session.id,
            heartbeatIntervalSeconds: 15
        }
    };
  }
}
