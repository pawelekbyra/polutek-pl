import { AccessTier } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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

function allowDemoFallbacks() {
  return process.env.ENABLE_DEMO_FALLBACKS === 'true' || process.env.NODE_ENV !== 'production';
}

export class AccessPolicy {
  static async canViewVideo(userId: string | null | undefined, videoId: string): Promise<AccessDecision> {
    let video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { creator: true }
    });

    if (!video && allowDemoFallbacks()) {
        // Fallback for demo/dev if DB is empty
        const { INITIAL_VIDEOS } = await import('../data/initial-content');
        const fallback = INITIAL_VIDEOS.find(v => v.id === videoId);
        if (fallback) {
            video = fallback as any;
        }
    }

    if (!video) return { allowed: false, reason: "NOT_FOUND" };

    // Public videos are always allowed
    if (video.tier === AccessTier.PUBLIC) return { allowed: true };

    if (!userId) return { allowed: false, reason: "LOGIN_REQUIRED", requiredTier: video.tier };

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.isDeleted) return { allowed: false, reason: "DELETED" };

    // Admins have access to everything
    if (user.role === 'ADMIN') return { allowed: true };

    // Logged in tier
    if (video.tier === AccessTier.LOGGED_IN) return { allowed: true };

    // Patron tier
    if (video.tier === AccessTier.PATRON) {
      if (user.isPatron) return { allowed: true };
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
