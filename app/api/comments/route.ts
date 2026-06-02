import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { AccessPolicy } from '@/lib/access/access-policy';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { isAllowedMediaUrl } from '@/lib/blob';

export const dynamic = 'force-dynamic';

const postCommentSchema = z.object({
  videoId: z.string(),
  text: z.string().trim().min(1).max(2000).optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().refine((url) => isAllowedMediaUrl(url), "Zablokowany host obrazka").optional().nullable(),
}).refine(data => data.text || data.imageUrl, {
  message: "Treść komentarza lub obrazek jest wymagany",
  path: ["text"]
});

/**
 * API Route for fetching comments for a video.
 * RESILIENCE: Returns empty state if DB tables are missing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const sortBy = searchParams.get('sortBy') || 'newest';
  const cursor = searchParams.get('cursor') || undefined;

  const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 50);

  if (!videoId) {
    return NextResponse.json({ success: false, message: 'videoId is required' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
      const authData = await auth();
      userId = authData.userId;
  } catch {}

  // Access control check
  const decision = await AccessPolicy.canViewVideo(userId, videoId);
  if (!decision.allowed) {
      return NextResponse.json({
          success: false,
          message: decision.reason,
          requiredTier: decision.requiredTier
      }, { status: 403 });
  }

  try {
    let internalUserId = null;
    if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        internalUserId = user?.id ?? null;
    }

    const orderBy: Prisma.CommentOrderByWithRelationInput | Prisma.CommentOrderByWithRelationInput[] = sortBy === 'top'
        ? [
            { likes: { _count: 'desc' } },
            { createdAt: 'desc' }
          ]
        : { createdAt: 'desc' };

    const comments = await prisma.comment.findMany({
        where: { videoId, parentId: null },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy,
        include: {
            author: {
                select: { id: true, name: true, username: true, imageUrl: true, isPatron: true, referralPoints: true, role: true }
            },
            replies: {
                take: 3,
                include: {
                    author: { select: { id: true, name: true, username: true, imageUrl: true, isPatron: true, referralPoints: true, role: true } },
                    _count: { select: { likes: true, dislikes: true } }
                },
                orderBy: { createdAt: 'asc' }
            },
            _count: {
                select: { likes: true, dislikes: true, replies: true }
            }
        }
    });


    // BATCH OPTIMIZATION: Fetch all likes/dislikes for the current user and these comments in one go
    const commentIds = [
        ...comments.map(c => c.id),
        ...comments.flatMap(c => c.replies.map(r => r.id))
    ];

    let userLikes = new Set<string>();
    let userDislikes = new Set<string>();

    if (internalUserId && commentIds.length > 0) {
        const [likes, dislikes] = await Promise.all([
            prisma.commentLike.findMany({
                where: { userId: internalUserId, commentId: { in: commentIds } },
                select: { commentId: true }
            }),
            prisma.commentDislike.findMany({
                where: { userId: internalUserId, commentId: { in: commentIds } },
                select: { commentId: true }
            })
        ]);
        userLikes = new Set(likes.map(l => l.commentId));
        userDislikes = new Set(dislikes.map(d => d.commentId));
    }

    const commentsWithStatus = comments.map(c => {
        const isDeleted = !!c.deletedAt;
        const replies = c.replies.map((r) => ({
            ...r,
            text: r.deletedAt ? "Komentarz usunięty" : r.text,
            author: r.deletedAt ? null : r.author,
            isLiked: userLikes.has(r.id),
            isDisliked: userDislikes.has(r.id),
            authorName: r.deletedAt ? "Użytkownik" : (r.author?.username || r.author?.name || "Użytkownik"),
        }));

        return {
            ...c,
            text: isDeleted ? "Komentarz usunięty" : c.text,
            author: isDeleted ? null : c.author,
            isLiked: userLikes.has(c.id),
            isDisliked: userDislikes.has(c.id),
            authorName: isDeleted ? "Użytkownik" : (c.author?.username || c.author?.name || "Użytkownik"),
            replies,
        };
    });

    const nextCursor = comments.length === limit ? comments[limit - 1].id : null;
    return NextResponse.json({ success: true, comments: commentsWithStatus, nextCursor });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
      const authData = await auth();
      userId = authData.userId;
  } catch {
      return NextResponse.json({
          success: false,
          error: "CLERK_ERROR",
          message: 'Błąd weryfikacji sesji.'
      }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });
  }

  // Rate Limiting
  const rateLimitResult = await rateLimit({
      key: `comments:${userId}`,
      limit: 5,
      windowMs: 60 * 1000
  });

  if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, message: "Zbyt dużo komentarzy. Spróbuj za chwilę." }, { status: 429 });
  }

  try {
    await UserService.getOrCreateUser(userId);

    const body = await request.json();
    const result = postCommentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: result.error.flatten() }, { status: 400 });
    }

    const { videoId, text, parentId, imageUrl } = result.data;

    // Access control check
    const decision = await AccessPolicy.canComment(userId, videoId);
    if (!decision.allowed) {
        return NextResponse.json({ success: false, message: decision.reason }, { status: 403 });
    }

    if (parentId) {
        const parent = await prisma.comment.findUnique({
          where: { id: parentId },
          select: { videoId: true, parentId: true, deletedAt: true }
        });

        if (!parent || parent.videoId !== videoId) {
            return NextResponse.json({ success: false, message: "Nieprawidłowy komentarz nadrzędny." }, { status: 400 });
        }

        // Prevent nesting deeper than 1 level
        if (parent.parentId) {
            return NextResponse.json({ success: false, message: "Nie można odpowiadać na odpowiedzi." }, { status: 400 });
        }

        // Prevent replying to deleted comments
        if (parent.deletedAt) {
          return NextResponse.json({ success: false, message: "Nie można odpowiadać na usunięty komentarz." }, { status: 400 });
        }
    }

    const newComment = await prisma.comment.create({
        data: {
            videoId,
            text: text?.trim() || '',
            authorId: userId,
            parentId: parentId || null,
            imageUrl: imageUrl || null,
        },
        include: {
            author: { select: { id: true, name: true, username: true, imageUrl: true, isPatron: true, referralPoints: true, role: true } },
            _count: { select: { likes: true, dislikes: true, replies: true } }
        }
    });

    return NextResponse.json({
        success: true,
        comment: {
            ...newComment,
            isLiked: false,
            isDisliked: false,
            authorName: newComment.author?.username || newComment.author?.name || "Użytkownik",
            replies: [],
        }
    }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
    let userId: string | null = null;
    try {
        const authData = await auth();
        userId = authData.userId;
    } catch {
        return NextResponse.json({ error: "Handshake Error" }, { status: 401 });
    }

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('id');

        if (!commentId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

        const comment = await prisma.comment.findUnique({
          where: { id: commentId },
          include: { video: { select: { creatorId: true } } }
        });
        if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const actor = await prisma.user.findUnique({
          where: { id: userId },
          include: { creators: { select: { id: true } } }
        });
        const isOwner = comment.authorId === userId;
        const isAdmin = actor?.role === "ADMIN";
        const isVideoCreator = actor?.creators.some(c => c.id === comment.video.creatorId);

        if (!isOwner && !isAdmin && !isVideoCreator) {
            return NextResponse.json({
              error: "Forbidden",
              message: "Comment deletion is limited to author, video creator and admin."
            }, { status: 403 });
        }

        await prisma.comment.update({
            where: { id: commentId },
            data: {
                deletedAt: new Date(),
                deletedById: userId,
                text: "",
                imageUrl: null
            }
        });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
