import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
import { CommentModerationService } from '@/lib/services/comments/comment-moderation.service';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { countGraphemes } from '@/lib/utils/graphemes';
import { z } from 'zod';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { GetOrCreateUserUseCase } from '@/lib/modules/users';

export const dynamic = 'force-dynamic';

export async function PATCH(
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

    const body = await request.json();
    const { text } = z.object({ text: z.string().trim().min(1) }).parse(body);

    if (countGraphemes(text) > 2000) {
        return NextResponse.json({ success: false, message: 'Komentarz jest za długi.' }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { videoId: true } });
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [video, canModerate] = await Promise.all([
        prisma.video.findUnique({ where: { id: comment.videoId }, select: { id: true, creator: { select: { userId: true } } } }),
        CommentAccessService.canModerate(userId as any, comment.videoId)
    ]);

    const updated = await CommentService.updateComment((localUser as any).id, commentId, text);

    const videoCreatorId = video?.creator?.userId || null;
    const context = { userId: userId as any, canModerate, videoCreatorId };

    return NextResponse.json({ success: true, comment: CommentService.mapToDto(updated, context) });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_PATCH_ERROR]', error);
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
  if (actor.type === 'guest' || actor.type === 'system') return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

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

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, videoId: true }
    });
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canModerate = await CommentAccessService.canModerate((localUser as any).id, comment.videoId);
    const isAuthor = comment.authorId === (localUser as any).id;

    if (!isAuthor && !canModerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reason = isAuthor ? 'AUTHOR_DELETED' : 'MODERATOR_DELETED';
    await CommentModerationService.softDelete(commentId, (localUser as any).id, reason);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_DELETE_ERROR]', error);
    return handleApiError(error);
  }
}
