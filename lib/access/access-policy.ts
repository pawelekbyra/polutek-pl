import { AccessTier, Prisma, VideoStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canUseDemoFallbacks } from '../feature-flags';
import { isPatronLikeUser } from './comment-access';


export type AccessVideo = Prisma.VideoGetPayload<{ include: { creator: true } }> | {
  id: string;
  tier: AccessTier;
  status: VideoStatus;
  publishedAt: Date | null;
};

function mapFallbackVideoToAccessVideo(fallback: { id: string; tier?: AccessTier; status?: VideoStatus; publishedAt?: Date | string | null }): AccessVideo {
  return {
    id: fallback.id,
    tier: fallback.tier ?? AccessTier.PUBLIC,
    status: fallback.status ?? VideoStatus.PUBLISHED,
    publishedAt: fallback.publishedAt ? new Date(fallback.publishedAt) : new Date(0),
  };
}

export type AccessDecision = {
  allowed: boolean;
  reason?:
    | "LOGIN_REQUIRED"
    | "PATRON_REQUIRED"
    | "ADMIN_REQUIRED"
    | "NOT_FOUND"
    | "DELETED"
    | "FORBIDDEN";
  requiredTier?: AccessTier;
};

export class AccessPolicy {
  static async canViewVideo(
    userId: string | null | undefined,
    videoId: string,
    prefetchedVideo?: AccessVideo | null
  ): Promise<AccessDecision> {
    let video: AccessVideo | null = prefetchedVideo ?? await prisma.video.findUnique({
      where: { id: videoId },
      include: { creator: true }
    });

    if (!video && canUseDemoFallbacks()) {
        // Fallback for demo/dev if DB is empty
        const { INITIAL_VIDEOS } = await import('../data/initial-content');
        const fallback = INITIAL_VIDEOS.find(v => v.id === videoId);
        if (fallback) {
            video = mapFallbackVideoToAccessVideo(fallback);
        }
    }

    if (!video) return { allowed: false, reason: "NOT_FOUND" };

    if (video.status === VideoStatus.ARCHIVED) {
        return { allowed: false, reason: "NOT_FOUND" };
    }

    // 1. Check Publication Status
    const isPublished = video.status === VideoStatus.PUBLISHED &&
                        (!video.publishedAt || video.publishedAt <= new Date());

    if (!isPublished) {
        // Only Admins can see non-published content
        if (userId) {
            const actor = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, isDeleted: true }
            });
            if (actor?.role === 'ADMIN' && !actor?.isDeleted) {
                // Admin allowed to see drafts/archives
            } else {
                return { allowed: false, reason: "NOT_FOUND" };
            }
        } else {
            return { allowed: false, reason: "NOT_FOUND" };
        }
    }

    // Public videos are always allowed
    if (video.tier === AccessTier.PUBLIC) return { allowed: true };

    if (!userId) return { allowed: false, reason: "LOGIN_REQUIRED", requiredTier: video.tier };

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.isDeleted) return { allowed: false, reason: "DELETED" };

    // Admins have access to everything
    if (user?.role === 'ADMIN') return { allowed: true };

    // Logged in tier only requires an authenticated Clerk session. A missing
    // local row should not block freshly signed-in users before profile sync.
    if (video.tier === AccessTier.LOGGED_IN) return { allowed: true };

    // Patron tier uses User.isPatron as the single source of truth (admins are explicitly allowed above).
    if (video.tier === AccessTier.PATRON) {
      if (isPatronLikeUser(user)) return { allowed: true };
      return { allowed: false, reason: "PATRON_REQUIRED", requiredTier: AccessTier.PATRON };
    }

    return { allowed: false, reason: "FORBIDDEN" };
  }

  static async canComment(userId: string | null | undefined, videoId: string): Promise<AccessDecision> {
    // Commenting policy usually matches viewing policy or is stricter (requires login)
    const viewDecision = await this.canViewVideo(userId, videoId);
    if (!viewDecision.allowed) return viewDecision;

    if (!userId) return { allowed: false, reason: "LOGIN_REQUIRED" };
    return { allowed: true };
  }

  static async canReactToVideo(userId: string | null | undefined, videoId: string): Promise<AccessDecision> {
    return this.canComment(userId, videoId);
  }

  static async canReactToComment(userId: string | null | undefined, commentId: string): Promise<AccessDecision> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { videoId: true }
    });

    if (!comment) return { allowed: false, reason: "NOT_FOUND" };

    return this.canComment(userId, comment.videoId);
  }

  static async canManageAdmin(userId: string | null | undefined): Promise<AccessDecision> {
    if (!userId) return { allowed: false, reason: "LOGIN_REQUIRED" };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role === 'ADMIN') return { allowed: true };
    return { allowed: false, reason: "ADMIN_REQUIRED" };
  }
}
