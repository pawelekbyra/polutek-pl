import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { AccessPolicy } from '@/lib/access/access-policy';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const postCommentSchema = z.object({
  videoId: z.string(),
  text: z.string().max(2000).optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
}).refine(data => data.text || data.imageUrl, {
  message: "Either text or imageUrl must be provided",
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

  if (!process.env.DATABASE_URL) {
    console.error("[GET_COMMENTS] DATABASE_URL is missing.");
    return NextResponse.json({ success: true, comments: [], nextCursor: null, warning: "System offline." });
  }

  let userId: string | null = null;
  try {
      const authData = await auth();
      userId = authData.userId;
  } catch (e) {}

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
                select: { id: true, name: true, username: true, imageUrl: true }
            },
            replies: {
                take: 3,
                include: {
                    author: { select: { id: true, name: true, username: true, imageUrl: true } },
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
        const replies = c.replies.map((r: any) => ({
            ...r,
            isLiked: userLikes.has(r.id),
            isDisliked: userDislikes.has(r.id),
            authorName: r.author?.username || r.author?.name || "Użytkownik",
        }));

        return {
            ...c,
            isLiked: userLikes.has(c.id),
            isDisliked: userDislikes.has(c.id),
            authorName: c.author?.username || c.author?.name || "Użytkownik",
            replies,
        };
    });

    const nextCursor = comments.length === limit ? comments[limit - 1].id : null;
    return NextResponse.json({ success: true, comments: commentsWithStatus, nextCursor });
  } catch (error: unknown) {
    console.error('[GET_COMMENTS_API_ERROR]', error);
    // P2021: Table missing - return success but empty state to avoid frontend crash
    if ((error as any).code === 'P2021' || (error as any).message?.includes("P2021")) {
        return NextResponse.json({ success: true, comments: [], nextCursor: null, warning: "Database not initialized. Run 'npx prisma db push'." });
    }
    return NextResponse.json({ success: false, message: 'Błąd podczas pobierania komentarzy.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
      const authData = await auth();
      userId = authData.userId;
  } catch (e) {
      return NextResponse.json({
          success: false,
          error: "CLERK_ERROR",
          message: 'Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API CLERK_SECRET_KEY i NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY w panelu Vercel.'
      }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });
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
        const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { videoId: true } });
        if (!parent || parent.videoId !== videoId) {
            return NextResponse.json({ success: false, message: "Invalid parent comment" }, { status: 400 });
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
            author: { select: { id: true, name: true, username: true, imageUrl: true } },
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
    console.error('[POST_COMMENT_API_ERROR]', error);
    if ((error as any).code === 'P2021') {
        return NextResponse.json({ success: false, message: "Baza danych nie jest gotowa (P2021)." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
    let userId: string | null = null;
    try {
        const authData = await auth();
        userId = authData.userId;
    } catch (e) {
        return NextResponse.json({ error: "Handshake Error" }, { status: 401 });
    }

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('id');

        if (!commentId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true }
        });
        const isOwner = comment.authorId === userId;
        const isAdmin = actor?.role === "ADMIN";

        if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await prisma.comment.delete({ where: { id: commentId } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
