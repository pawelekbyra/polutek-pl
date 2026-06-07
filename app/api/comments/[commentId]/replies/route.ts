import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { CommentService } from '@/lib/services/comments/comment.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { handleApiError } from '@/lib/errors';
import { publicCommentAuthorSelect } from '@/lib/comments-public-author';
import { CommentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') || undefined;
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const { userId } = await auth();

  try {
    const parentComment = await prisma.comment.findUnique({ where: { id: params.commentId }, select: { videoId: true } });
    if (!parentComment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canView = await CommentAccessService.canViewComments(userId, parentComment.videoId);
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [video, canModerate] = await Promise.all([
        prisma.video.findUnique({ where: { id: parentComment.videoId }, select: { creator: { select: { userId: true } } } }),
        CommentAccessService.canModerate(userId, parentComment.videoId)
    ]);
    const videoCreatorId = video?.creator?.userId || null;
    const context = { userId, canModerate, videoCreatorId };

    const replies = await prisma.comment.findMany({
      where: {
        parentId: params.commentId,
        status: canModerate ? undefined : CommentStatus.VISIBLE
      },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: publicCommentAuthorSelect },
        reactions: userId ? { where: { userId } } : false
      }
    });

    return NextResponse.json({
      success: true,
      replies: replies.map(r => CommentService.mapToDto(r, context)),
      nextCursor: replies.length === limit ? replies[limit - 1].id : null
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
