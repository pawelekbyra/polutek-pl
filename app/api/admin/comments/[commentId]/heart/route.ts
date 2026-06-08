import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { CommentService } from '@/lib/services/comments/comment.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { adminUserId, response } = await requireAdminForApi("HEART_COMMENT_ADMIN");
  if (response) return response;

  try {
    const updated = await CommentService.toggleHeart(params.commentId, adminUserId);
    return NextResponse.json({ success: true, isHearted: updated.isHearted });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
