import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { CommentModerationService } from '@/lib/services/comments/comment-moderation.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { adminUserId, response } = await requireAdminForApi("HIDE_COMMENT");
  if (response) return response;

  try {
    await CommentModerationService.hide(params.commentId, adminUserId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
