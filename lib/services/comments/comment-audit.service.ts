import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function logCommentAction(
  actorUserId: string,
  action: string,
  commentId: string,
  videoId: string,
  metadata: any = {}
) {
  return await prisma.auditLog.create({
    data: {
      actorUserId,
      action: `COMMENT_${action}`,
      targetType: 'COMMENT',
      targetId: commentId,
      metadata: {
        commentId,
        videoId,
        ...metadata
      }
    }
  });
}
