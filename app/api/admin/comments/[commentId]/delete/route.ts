import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { CommentModerationService } from '@/lib/services/comments/comment-moderation.service';
import { handleApiError } from '@/lib/errors';
import { CommentDeletedReason } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { adminUserId, response } = await requireAdminForApi("DELETE_COMMENT_ADMIN");
  if (response) return response;

  try {
    const { reason } = await request.json().catch(() => ({ reason: 'MODERATOR_DELETED' }));
    await CommentModerationService.softDelete(params.commentId, adminUserId, reason as CommentDeletedReason || 'MODERATOR_DELETED');
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
