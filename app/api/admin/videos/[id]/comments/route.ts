import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
import { handleApiError } from '@/lib/errors';
import { requireAdminForApi } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_VIDEO_COMMENTS");
  if (response) return response;

  const userId = adminUserId;

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'newest';
    const limit = 50;

    const data = await CommentService.getComments(params.id, userId, sortBy, cursor, limit);

    return NextResponse.json({
        success: true,
        comments: data.comments,
        totalCount: data.totalCount,
        nextCursor: data.nextCursor
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
