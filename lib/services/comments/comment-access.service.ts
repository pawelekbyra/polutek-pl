import { AccessTier } from '@prisma/client';
import { AccessPolicy } from '@/lib/access/access-policy';

export class CommentAccessService {
  static async canViewComments(userId: string | null | undefined, videoId: string) {
    const decision = await AccessPolicy.canViewVideo(userId, videoId);
    return decision.allowed;
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
    return await AccessPolicy.canManageAdmin(userId).then(d => d.allowed);
    // Note: In a real scenario, we'd also check if user is the video creator.
    // AccessPolicy.canManageAdmin currently only checks global ADMIN role.
  }
}
