import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';
import { getVideoSourceInfo } from '@/lib/media/video-source';
import { isAllowedVideoSourceUrl } from '@/lib/blob';
import { AccessTier, VideoStatus } from '@prisma/client';
import type { PlaybackPlan } from './playback.dto';

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
  static async createPlaybackPlan(videoId: string, userId: string | null, ipHash?: string, userAgentHash?: string): Promise<PlaybackPlan> {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { asset: true }
    });

    if (!video) {
        return {
            videoId,
            canPlay: false,
            access: { allowed: false, reason: "VIDEO_NOT_FOUND" },
            player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: '', title: '' },
            diagnostics: { warnings: ["Video not found"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    const decision = await AccessPolicy.canViewVideo(userId, videoId, video);

    if (!decision.allowed) {
        return {
            videoId,
            canPlay: false,
            access: {
                allowed: false,
                reason: decision.reason,
                requiredTier: decision.requiredTier
            },
            player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: video.thumbnailUrl, title: video.title },
            diagnostics: { warnings: [decision.reason || "Access denied"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    const videoUrl = video.videoUrl; // In future, check asset first

    if (!videoUrl) {
        return {
            videoId,
            canPlay: false,
            access: { allowed: true },
            source: undefined,
            player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: video.thumbnailUrl, title: video.title },
            diagnostics: { warnings: ["Video URL missing"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    if (!isAllowedVideoSourceUrl(videoUrl)) {
        return {
            videoId,
            canPlay: false,
            access: { allowed: true },
            player: { autoplayAllowed: false, mutedAutoplay: false, controls: false, poster: video.thumbnailUrl, title: video.title },
            diagnostics: { warnings: ["Video URL not allowed"], sourceConfidence: "LOW" },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    const sourceInfo = getVideoSourceInfo(videoUrl, `/api/media/${video.id}`);

    const isAdminPreview = userId ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
    }).then(u => u?.role === 'ADMIN') : false;

    const session = await prisma.videoPlaybackSession.create({
        data: {
            videoId,
            userId,
            ipHash,
            userAgentHash,
            sourceKind: sourceInfo.kind,
            accessTier: video.tier,
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
            posterUrl: video.thumbnailUrl,
            needsProxy: sourceInfo.needsProxy,
            isExternalEmbed: sourceInfo.kind === 'youtube' || sourceInfo.kind === 'vimeo',
            isSignedUrl: false,
        },
        player: {
            autoplayAllowed: true,
            mutedAutoplay: true,
            controls: true,
            poster: video.thumbnailUrl,
            title: video.title
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
