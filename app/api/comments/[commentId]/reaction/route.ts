import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentReactionService } from '@/lib/services/comments/comment-reaction.service';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { GetOrCreateUserUseCase } from '@/lib/modules/users';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();
  if (actor.type === 'guest' || !('userId' in actor)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = actor.userId;

  const { commentId } = params;

  try {
    const ctx = createAppContext({ actor });
    const { sessionClaims } = await auth();
    const email = (sessionClaims as any)?.email as string;
    const localUser = await GetOrCreateUserUseCase.execute(ctx, {
        id: actor.userId,
        email,
        name: (sessionClaims as any)?.name,
        username: (sessionClaims as any)?.username,
        imageUrl: (sessionClaims as any)?.image_url || (sessionClaims as any)?.picture
    });
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
  const actor = await getActorFromAuth();
  if (actor.type === 'guest' || !('userId' in actor)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  const userId = actor.userId;

  const { commentId } = params;

  try {
    const ctx = createAppContext({ actor });
    const { sessionClaims } = await auth();
    const email = (sessionClaims as any)?.email as string;
    const localUser = await GetOrCreateUserUseCase.execute(ctx, {
        id: actor.userId,
        email,
        name: (sessionClaims as any)?.name,
        username: (sessionClaims as any)?.username,
        imageUrl: (sessionClaims as any)?.image_url || (sessionClaims as any)?.picture
    });
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
