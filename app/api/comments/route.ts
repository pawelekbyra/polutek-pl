import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { AccessPolicy } from '@/lib/access/access-policy';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { isAllowedCommentImageUrl } from '@/lib/blob';
import { toPublicCommentAuthor } from '@/lib/comments-public-author';
import { CommentService } from '@/lib/services/comments/comment.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';

export const dynamic = 'force-dynamic';

const postCommentSchema = z.object({
  videoId: z.string(),
  text: z.string().trim().min(1).max(2000).optional(),
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

export async function GET(request: NextRequest) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const sortBy = (searchParams.get('sortBy') as any) || 'newest';
  const cursor = searchParams.get('cursor') || undefined;
  const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 50);

  if (!videoId) return NextResponse.json({ success: false, message: 'videoId is required' }, { status: 400 });

  const { userId } = await getSafeAuth();

  try {
    const [commentsData, canComment, canModerate] = await Promise.all([
      CommentService.getComments(videoId, userId, sortBy, cursor, limit),
      CommentAccessService.canComment(userId, videoId),
      CommentAccessService.canModerate(userId, videoId)
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

export async function POST(request: NextRequest) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { userId, sessionClaims } = await getSafeAuth();
  if (!userId) return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });

  const rateLimitResult = await rateLimit({ key: `comments:${userId}`, limit: 5, windowMs: 60 * 1000 });
  if (!rateLimitResult.success) return NextResponse.json({ success: false, message: "Zbyt dużo komentarzy. Spróbuj za chwilę." }, { status: 429 });

  try {
    const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
    if (!localUser) return NextResponse.json({ success: false, message: 'Nie udało się zsynchronizować profilu użytkownika.' }, { status: 500 });

    const result = postCommentSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: result.error.flatten() }, { status: 400 });

    const { videoId, text, parentId, imageUrl } = result.data;
    const decision = await CommentAccessService.canComment(userId, videoId);
    if (!decision.allowed) {
        scopedLogger.warn(`Comment access denied for user ${userId} on video ${videoId}: ${decision.reason}`);
        return NextResponse.json({
            success: false,
            message: decision.reason === "PATRON_REQUIRED" ? "Ten film jest dostępny tylko dla Patronów." : (decision.reason || "Brak uprawnień do komentowania.")
        }, { status: 403 });
    }

    const newComment = await CommentService.createComment(localUser.id, videoId, text || '', parentId || undefined, imageUrl || undefined);

    return NextResponse.json({
        success: true,
        comment: CommentService.mapToDto(newComment, localUser.id)
    }, { status: 201 });
  } catch (error: unknown) {
    scopedLogger.error("[POST_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
    const requestId = getCorrelationId();
    const scopedLogger = createScopedLogger(requestId);
    const { userId, sessionClaims } = await getSafeAuth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const result = z.object({ commentId: z.string(), pinned: z.boolean() }).safeParse(await request.json());
        if (!result.success) return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: result.error.flatten() }, { status: 400 });

        const { commentId, pinned } = result.data;
        const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { video: { select: { id: true, creatorId: true } } } });
        if (!comment || comment.parentId || comment.deletedAt) return NextResponse.json({ error: "Not found or invalid" }, { status: 404 });

        const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
        if (!localUser) return NextResponse.json({ success: false, message: 'Nie udało się zsynchronizować profilu użytkownika.' }, { status: 500 });

        const actor = await prisma.user.findUnique({ where: { id: localUser.id }, include: { creators: { select: { id: true } } } });
        if (actor?.role !== "ADMIN" && !actor?.creators.some(c => c.id === comment.video.creatorId)) {
            return NextResponse.json({ error: "Forbidden", message: "Comment pinning is limited to video creator and admin." }, { status: 403 });
        }

        const updatedComment = await prisma.$transaction(async (tx) => {
          if (!pinned) return tx.comment.update({ where: { id: commentId }, data: { pinnedAt: null, pinnedById: null } });
          await tx.comment.updateMany({ where: { videoId: comment.video.id, parentId: null, pinnedAt: { not: null }, id: { not: commentId } }, data: { pinnedAt: null, pinnedById: null } });
          return tx.comment.update({ where: { id: commentId }, data: { pinnedAt: new Date(), pinnedById: localUser.id } });
        });

        return NextResponse.json({ success: true, isPinned: !!updatedComment.pinnedAt, pinnedAt: updatedComment.pinnedAt });
    } catch (error: unknown) {
        scopedLogger.error("[PATCH_COMMENT_ERROR]", error);
        return handleApiError(error);
    }
}

export async function DELETE(request: NextRequest) {
    const requestId = getCorrelationId();
    const scopedLogger = createScopedLogger(requestId);
    const { userId, sessionClaims } = await getSafeAuth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const commentId = new URL(request.url).searchParams.get('id');
        if (!commentId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

        const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { video: { select: { creatorId: true } } } });
        if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
        if (!localUser) return NextResponse.json({ success: false, message: 'Nie udało się zsynchronizować profilu użytkownika.' }, { status: 500 });

        const actor = await prisma.user.findUnique({ where: { id: localUser.id }, include: { creators: { select: { id: true } } } });
        if (comment.authorId !== localUser.id && actor?.role !== "ADMIN" && !actor?.creators.some(c => c.id === comment.video.creatorId)) {
            return NextResponse.json({ error: "Forbidden", message: "Comment deletion is limited to author, video creator and admin." }, { status: 403 });
        }

        await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date(), deletedById: localUser.id, text: "", imageUrl: null } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        scopedLogger.error("[DELETE_COMMENT_ERROR]", error);
        return handleApiError(error);
    }
}
