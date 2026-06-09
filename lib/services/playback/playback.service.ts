import { prisma as defaultPrisma } from '@/lib/prisma';
// R6/R3 delivery: Playback now uses modular access.
import { checkVideoAccess } from '@/lib/modules/access';
import { getVideoSourceInfo } from '@/lib/media/video-source';
import { isAllowedVideoSourceUrl } from '@/lib/blob';
import { StorageService } from '../storage/storage.service';
import type { PlaybackPlan } from './playback.dto';
import { AppContext, createAppContext } from '@/lib/modules/shared/app-context';

export type PlaybackErrorCode =
  | "VIDEO_NOT_FOUND"
  | "VIDEO_ARCHIVED"
  | "VIDEO_NOT_PUBLISHED"
  | "LOGIN_REQUIRED"
  | "PATRON_REQUIRED"
  | "VIDEO_SOURCE_MISSING"
  | "VIDEO_SOURCE_NOT_ALLOWED"
  | "UNKNOWN_PLAYBACK_ERROR";

export class PlaybackService {
  /**
   * @deprecated Use the version with AppContext
   */
  static async createPlaybackPlan(videoId: string, userId: string | null, ipHash?: string, userAgentHash?: string): Promise<PlaybackPlan> {
      const ctx = createAppContext({
          actor: userId ? { type: 'user', userId, isPatron: false } : { type: 'guest' }
      });
      return this.createPlaybackPlanWithContext(videoId, ctx, ipHash, userAgentHash);
  }

  static async createPlaybackPlanWithContext(videoId: string, ctx: AppContext, ipHash?: string, userAgentHash?: string): Promise<PlaybackPlan> {
    const { prisma, actor } = ctx;

    const accessResult = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);

    if (!accessResult.ok) {
        // Fallback for system errors in access check
        return {
            videoId,
            canPlay: false,
            access: { allowed: false, reason: "FORBIDDEN" as any },
            player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: '', title: '' },
            diagnostics: { warnings: ["Internal error during access check"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    const decision = accessResult.data;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        asset: true,
      }
    });

    if (!video) {
        // If it's not in DB, checkVideoAccess might have used demo fallback.
        // If not, it's really NOT_FOUND.
        if (!decision.hasAccess && decision.reason === 'NOT_FOUND') {
            return {
                videoId,
                canPlay: false,
                access: { allowed: false, reason: "VIDEO_NOT_FOUND" },
                player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: '', title: '' },
                diagnostics: { warnings: ["Video not found"], sourceConfidence: "LOW" },
                tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
            };
        }
    }

    if (!decision.hasAccess) {
        return {
            videoId,
            canPlay: false,
            access: {
                allowed: false,
                reason: decision.reason as any,
                requiredTier: decision.requiredTier
            },
            player: {
                autoplayAllowed: false,
                mutedAutoplay: false,
                controls: false,
                poster: video?.thumbnailUrl || '',
                title: video?.title || ''
            },
            diagnostics: { warnings: [decision.reason || "Access denied"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    // At this point decision.hasAccess is true.
    // If video is null but hasAccess is true, it means it's a demo fallback.
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

    if (!videoUrl) {
        return {
            videoId,
            canPlay: false,
            access: { allowed: true },
            source: undefined,
            player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: thumbnailUrl, title: title },
            diagnostics: { warnings: ["Video URL missing"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    if (!isAllowedVideoSourceUrl(videoUrl)) {
        return {
            videoId,
            canPlay: false,
            access: { allowed: true },
            player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: thumbnailUrl, title: title },
            diagnostics: { warnings: ["Video URL not allowed"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    let sourceUrl = videoUrl;
    let isSignedUrl = false;
    let expiresAt: string | undefined = undefined;

    if (video?.asset) {
        try {
            const signedData = await StorageService.getPresignedUrl(
                video.asset.provider,
                video.asset.bucket || process.env.R2_BUCKET_NAME || '',
                video.asset.objectKey,
                900
            );
            sourceUrl = signedData.url;
            isSignedUrl = true;
            expiresAt = signedData.expiresAt.toISOString();
        } catch (e) {
            console.error("[PLAYBACK_SERVICE] Failed to sign URL", e);
        }
    }

    const sourceInfo = getVideoSourceInfo(sourceUrl, `/api/media/${videoId}`);

    const isAdminPreview = actor.type === 'admin';

    // Issue 7: Create session only if source is valid and plan is actually being returned
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
        canPlay: true,
        access: { allowed: true },
        source: {
            provider: sourceInfo.kind, // Mapping kind to provider for DTO compatibility
            kind: sourceInfo.kind,
            playbackUrl: sourceInfo.playbackUrl,
            embedUrl: sourceInfo.embedUrl,
            posterUrl: thumbnailUrl,
            needsProxy: sourceInfo.needsProxy,
            isExternalEmbed: sourceInfo.kind === 'youtube' || sourceInfo.kind === 'vimeo',
            isSignedUrl,
            expiresAt,
        },
        player: {
            autoplayAllowed: true,
            mutedAutoplay: true,
            controls: true,
            poster: thumbnailUrl,
            title: title
        },
        diagnostics: {
            warnings: [],
            sourceConfidence: "HIGH"
        },
        tracking: {
            playbackSessionId: session.id,
            heartbeatIntervalSeconds: 15
        }
    };
  }
}
