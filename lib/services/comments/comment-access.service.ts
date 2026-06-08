import { AccessTier } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';
import { isUuid } from '@/lib/utils/uuid';

export class CommentAccessService {
  static async canViewComments(userId: string | null | undefined, videoId: string) {
    try {
        // Users can read comments on any video that exists and is not archived.
        // We check existence via AccessPolicy to handle slugs and demo fallbacks.
        const decision = await AccessPolicy.canViewVideo(userId, videoId);

        // If it's NOT_FOUND or DELETED, we hide comments.
        // Otherwise (even if it's PATRON_REQUIRED), we allow viewing comments.
        if (decision.reason === 'NOT_FOUND' || decision.reason === 'DELETED') {
            return false;
        }

        return true;
    } catch (err: any) {
        // Handle Prisma error P2023 (Inconsistent column data / invalid UUID)
        if (err.code === 'P2023') {
            return false;
        }
        throw err;
    }
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

    // In single-channel mode, we only allow the configured main channel owner to moderate
    // if their userId matches the authenticated user.
    if (videoId) {
        const mainChannel = await prisma.creator.findFirst({
            where: {
                isApproved: true,
                isPrimary: true,
                userId, // Ownership check
                videos: {
                    some: isUuid(videoId) ? { id: videoId } : { slug: videoId }
                }
            },
            select: { id: true }
        });
        if (mainChannel) return true;
    }

    return false;
  }
}
