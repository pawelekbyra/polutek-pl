import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { CommentService } from '@/lib/services/comments/comment.service';
import { handleApiError } from '@/lib/errors';
import { publicCommentAuthorSelect } from '@/lib/comments-public-author';

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
    const replies = await prisma.comment.findMany({
      where: {
        parentId: params.commentId,
        status: { not: 'HIDDEN' }
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
      replies: replies.map(r => CommentService.mapToDto(r, userId)),
      nextCursor: replies.length === limit ? replies[limit - 1].id : null
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
