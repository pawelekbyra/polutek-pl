import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';
import { getVideoSourceInfo } from '@/lib/media/video-source';
import { isAllowedVideoSourceUrl } from '@/lib/blob';
import { AccessTier, VideoStatus } from '@prisma/client';

export type PlaybackErrorCode =
  | "VIDEO_NOT_FOUND"
  | "VIDEO_ARCHIVED"
  | "VIDEO_NOT_PUBLISHED"
  | "LOGIN_REQUIRED"
  | "PATRON_REQUIRED"
  | "VIDEO_SOURCE_MISSING"
  | "VIDEO_SOURCE_NOT_ALLOWED"
  | "UNKNOWN_PLAYBACK_ERROR";

export type PlaybackPlan = {
  videoId: string;
  canPlay: boolean;
  access: {
    allowed: boolean;
    reason?: string;
    requiredTier?: AccessTier;
  };
  source?: {
    kind: string;
    playbackUrl: string;
    embedUrl?: string;
    needsProxy: boolean;
  };
  tracking: {
    playbackSessionId: string;
    heartbeatIntervalSeconds: number;
  };
};

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
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    if (!isAllowedVideoSourceUrl(videoUrl)) {
        return {
            videoId,
            canPlay: false,
            access: { allowed: true },
            tracking: { playbackSessionId: '', heartbeatIntervalSeconds: 0 }
        };
    }

    const sourceInfo = getVideoSourceInfo(videoUrl, `/api/media/${video.id}`);

    const session = await prisma.videoPlaybackSession.create({
        data: {
            videoId,
            userId,
            ipHash,
            userAgentHash,
            sourceKind: sourceInfo.kind,
            accessTier: video.tier,
        }
    });

    return {
        videoId,
        canPlay: true,
        access: { allowed: true },
        source: {
            kind: sourceInfo.kind,
            playbackUrl: sourceInfo.playbackUrl,
            embedUrl: sourceInfo.embedUrl,
            needsProxy: sourceInfo.needsProxy
        },
        tracking: {
            playbackSessionId: session.id,
            heartbeatIntervalSeconds: 15
        }
    };
  }
}
