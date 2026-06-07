import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { commentId } = params;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { videoId: true, parentId: true, status: true }
    });

    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (comment.parentId) return NextResponse.json({ error: 'Only top-level comments can be pinned' }, { status: 400 });
    if (comment.status !== 'VISIBLE') return NextResponse.json({ error: 'Only visible comments can be pinned' }, { status: 400 });

    const canPin = await CommentAccessService.canModerate(userId, comment.videoId);
    if (!canPin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await CommentService.pinComment(commentId, userId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[PIN_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { commentId } = params;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { videoId: true }
    });

    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canUnpin = await CommentAccessService.canModerate(userId, comment.videoId);
    if (!canUnpin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await CommentService.unpinComment(commentId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[UNPIN_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}
