import { AccessTier } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';

export class CommentAccessService {
  static async canViewComments(userId: string | null | undefined, videoId: string) {
    // We allow everyone to read comments, even on patron-only videos
    return true;
  }

  static async canComment(userId: string | null | undefined, videoId: string) {
    if (!userId) return { allowed: false, reason: 'LOGIN_REQUIRED' };
    const decision = await AccessPolicy.canComment(userId, videoId);
    return decision;
  }

  static async canReact(userId: string | null | undefined, commentId: string) {
    if (!userId) return { allowed: false, reason: 'LOGIN_REQUIRED' };
    const decision = await AccessPolicy.canReactToComment(userId, commentId);
    return decision;
  }

  static async canModerate(userId: string | null | undefined, videoId: string) {
    if (!userId) return false;

    // Global admin can moderate everything
    const isAdmin = await AccessPolicy.canManageAdmin(userId).then(d => d.allowed);
    if (isAdmin) return true;

    // Video creator can moderate their own video comments
    if (videoId) {
        const creator = await prisma.creator.findFirst({
            where: { userId, videos: { some: { id: videoId } } },
            select: { id: true }
        });
        if (creator) return true;
    }

    return false;
  }
}
