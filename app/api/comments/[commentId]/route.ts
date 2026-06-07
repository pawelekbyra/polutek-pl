import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { commentId } = params;

  try {
    const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
    if (!localUser) return NextResponse.json({ success: false, message: 'User sync failed' }, { status: 500 });

    const body = await request.json();
    const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(body);

    const updated = await CommentService.updateComment(localUser.id, commentId, text);

    return NextResponse.json({ success: true, comment: CommentService.mapToDto(updated, localUser.id) });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_PATCH_ERROR]', error);
    return handleApiError(error);
  }
}
