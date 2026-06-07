import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { CommentService } from '@/lib/services/comments/comment.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { handleApiError } from '@/lib/errors';
import { publicCommentAuthorSelect } from '@/lib/comments-public-author';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { userId } = await auth();

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
      include: {
        author: { select: publicCommentAuthorSelect },
        parent: {
          include: {
            author: { select: publicCommentAuthorSelect }
          }
        },
        reactions: userId ? { where: { userId } } : false
      }
    });

    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canView = await CommentAccessService.canViewComments(userId, comment.videoId);
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // For context, we might want nearby comments, but for now let's just return the comment and its parent
    return NextResponse.json({
      success: true,
      comment: CommentService.mapToDto(comment, userId),
      parentComment: comment.parent ? CommentService.mapToDto(comment.parent, userId) : null,
      videoId: comment.videoId,
      canView: true
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
