import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentReactionService } from '@/lib/services/comments/comment-reaction.service';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';

export const dynamic = 'force-dynamic';

export async function PUT(
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

    const decision = await CommentAccessService.canReact(userId, commentId);
    if (!decision.allowed) {
      return NextResponse.json({ success: false, message: decision.reason }, { status: 403 });
    }

    const result = await CommentReactionService.like(localUser.id, commentId);
    return NextResponse.json({ success: true, liked: result.liked });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_REACTION_PUT_ERROR]', error);
    return handleApiError(error);
  }
}

export async function DELETE(
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

    const decision = await CommentAccessService.canReact(userId, commentId);
    if (!decision.allowed) {
      return NextResponse.json({ success: false, message: decision.reason }, { status: 403 });
    }

    const result = await CommentReactionService.unlike(localUser.id, commentId);
    return NextResponse.json({ success: true, liked: result.liked });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_REACTION_DELETE_ERROR]', error);
    return handleApiError(error);
  }
}
