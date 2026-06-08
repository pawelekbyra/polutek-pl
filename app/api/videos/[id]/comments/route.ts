import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
import { CommentModerationService } from '@/lib/services/comments/comment-moderation.service';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { isAllowedCommentImageUrl } from '@/lib/blob';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { countGraphemes } from '@/lib/utils/graphemes';
import { isUuid } from '@/lib/utils/uuid';

export const dynamic = 'force-dynamic';

const postCommentSchema = z.object({
  text: z.string().trim().min(1).optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().refine((url) => isAllowedCommentImageUrl(url), "Zablokowany host obrazka").optional().nullable(),
}).refine(data => data.text || data.imageUrl, {
  message: "Treść komentarza lub obrazek jest wymagany",
  path: ["text"]
});

async function getSafeAuth() {
  try {
    return await auth();
  } catch {
    return { userId: null, sessionClaims: null };
  }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { searchParams } = new URL(request.url);
  let videoId = params.id;

  if (!isUuid(videoId)) {
      const video = await prisma.video.findUnique({ where: { slug: videoId }, select: { id: true } });
      if (video) videoId = video.id;
  }

  const sortBy = (searchParams.get('sortBy') as any) || 'newest';
  const cursor = searchParams.get('cursor') || undefined;
  const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 50);

  const { userId } = await getSafeAuth();

  try {
    const canView = await CommentAccessService.canViewComments(userId, videoId);
    // Even if canView is technically always true now in Service, we keep the check for future-proofing or if we decide to revert.
    if (!canView) return NextResponse.json({ success: false, message: 'Brak dostępu do komentarzy' }, { status: 403 });

    const [video, canModerate] = await Promise.all([
        isUuid(videoId) ? prisma.video.findUnique({ where: { id: videoId }, select: { creator: { select: { userId: true } } } }) : null,
        CommentAccessService.canModerate(userId, videoId)
    ]);
    const videoCreatorId = video?.creator?.userId || null;
    const context = { userId, canModerate, videoCreatorId };

    const [commentsData, canComment] = await Promise.all([
      CommentService.getComments(videoId, userId, sortBy, cursor, limit, true),
      CommentAccessService.canComment(userId, videoId)
    ]);

    return NextResponse.json({
      success: true,
      comments: commentsData.comments,
      totalCount: commentsData.totalCount,
      nextCursor: commentsData.nextCursor,
      hasMore: !!commentsData.nextCursor,
      viewer: {
        canComment: canComment.allowed,
        canReact: !!userId,
        canReport: !!userId,
        canModerate: canModerate
      }
    });
  } catch (error: unknown) {
    scopedLogger.error("[GET_COMMENTS_ERROR]", error);
    return handleApiError(error);
  }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id?: string; commentId?: string } }
) {
    const requestId = getCorrelationId();
    const scopedLogger = createScopedLogger(requestId);
    const { userId, sessionClaims } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const commentId = params.commentId;
        if (!commentId) return NextResponse.json({ success: false, message: 'commentId is required' }, { status: 400 });

        const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
        if (!localUser) return NextResponse.json({ success: false, message: 'User sync failed' }, { status: 500 });

        const result = z.object({ pinned: z.boolean().optional(), text: z.string().trim().min(1).optional() }).safeParse(await request.json());
        if (!result.success) return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: result.error.flatten() }, { status: 400 });

        const { pinned, text } = result.data;

        if (text && countGraphemes(text) > 2000) {
            return NextResponse.json({ success: false, message: 'Komentarz jest za długi (max 2000 znaków).' }, { status: 400 });
        }

        const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { videoId: true } });
        if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const context = {
            userId: localUser.id,
            canModerate: await CommentAccessService.canModerate(localUser.id, comment.videoId),
            videoCreatorId: null // We could fetch it if needed for AUTHOR badge
        };

        if (pinned !== undefined) {
            if (!context.canModerate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

            if (pinned) {
                await CommentModerationService.pinComment(localUser.id, commentId);
            } else {
                await CommentModerationService.unpinComment(localUser.id, commentId);
            }
            return NextResponse.json({ success: true });
        }

        if (text !== undefined) {
            const updated = await CommentService.updateComment(localUser.id, commentId, text);
            return NextResponse.json({ success: true, comment: CommentService.mapToDto(updated, context) });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        scopedLogger.error("[PATCH_COMMENT_ERROR]", error);
        return handleApiError(error);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id?: string; commentId?: string } }
) {
    const requestId = getCorrelationId();
    const scopedLogger = createScopedLogger(requestId);
    const { userId, sessionClaims } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const commentId = params.commentId;
        if (!commentId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

        const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
        if (!localUser) return NextResponse.json({ success: false, message: 'User sync failed' }, { status: 500 });

        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: { authorId: true, videoId: true }
        });
        if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const canModerate = await CommentAccessService.canModerate(localUser.id, comment.videoId);
        const isAuthor = comment.authorId === localUser.id;

        if (!isAuthor && !canModerate) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const reason = isAuthor ? 'AUTHOR_DELETED' : 'MODERATOR_DELETED';
        await CommentModerationService.softDelete(commentId, localUser.id, reason);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        scopedLogger.error("[DELETE_COMMENT_ERROR]", error);
        return handleApiError(error);
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { userId, sessionClaims } = await getSafeAuth();
  if (!userId) return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });

  let videoId = params.id;
  if (!isUuid(videoId)) {
      const video = await prisma.video.findUnique({ where: { slug: videoId }, select: { id: true } });
      if (video) videoId = video.id;
  }

  const rateLimitResult = await rateLimit({ key: `comments:${userId}`, limit: 5, windowMs: 60 * 1000 });
  if (!rateLimitResult.success) return NextResponse.json({ success: false, message: "Zbyt dużo komentarzy. Spróbuj za chwilę." }, { status: 429 });

  try {
    const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
    if (!localUser) return NextResponse.json({ success: false, message: 'Nie udało się zsynchronizować profilu użytkownika.' }, { status: 500 });

    const result = postCommentSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: result.error.flatten() }, { status: 400 });

    const { text, parentId, imageUrl } = result.data;

    if (text && countGraphemes(text) > 2000) {
        return NextResponse.json({ success: false, message: 'Komentarz jest za długi (max 2000 znaków).' }, { status: 400 });
    }

    const decision = await CommentAccessService.canComment(userId, videoId);
    if (!decision.allowed) {
        scopedLogger.warn(`Comment access denied for user ${userId} on video ${videoId}: ${decision.reason}`);
        return NextResponse.json({
            success: false,
            message: decision.reason === "PATRON_REQUIRED" ? "Ten film jest dostępny tylko dla Patronów." : (decision.reason || "Brak uprawnień do komentowania.")
        }, { status: 403 });
    }

    const [video, canModerate] = await Promise.all([
        isUuid(videoId) ? prisma.video.findUnique({ where: { id: videoId }, select: { creator: { select: { userId: true } } } }) : null,
        CommentAccessService.canModerate(userId, videoId)
    ]);
    const videoCreatorId = video?.creator?.userId || null;
    const context = { userId, canModerate, videoCreatorId };

    const newComment = await CommentService.createComment(localUser.id, videoId, text || '', parentId || undefined, imageUrl || undefined);

    return NextResponse.json({
        success: true,
        comment: CommentService.mapToDto(newComment, context)
    }, { status: 201 });
  } catch (error: unknown) {
    scopedLogger.error("[POST_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}
