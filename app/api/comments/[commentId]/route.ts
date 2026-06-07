import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { countGraphemes } from '@/lib/utils/graphemes';
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
    const { text } = z.object({ text: z.string().trim().min(1) }).parse(body);

    if (countGraphemes(text) > 2000) {
        return NextResponse.json({ success: false, message: 'Komentarz jest za długi.' }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { videoId: true } });
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [video, canModerate] = await Promise.all([
        prisma.video.findUnique({ where: { id: comment.videoId }, select: { id: true, creator: { select: { userId: true } } } }),
        CommentAccessService.canModerate(userId, comment.videoId)
    ]);

    const updated = await CommentService.updateComment(localUser.id, commentId, text);

    const videoCreatorId = video?.creator?.userId || null;
    const context = { userId, canModerate, videoCreatorId };

    return NextResponse.json({ success: true, comment: CommentService.mapToDto(updated, context) });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_PATCH_ERROR]', error);
    return handleApiError(error);
  }
}
