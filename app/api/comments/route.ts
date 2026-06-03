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
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { ensureCommentPinningColumns } from '@/lib/db/comment-schema-heal';

export const dynamic = 'force-dynamic';

type CommentAuthor = {
  email?: string | null;
  name?: string | null;
  username?: string | null;
};

type ClerkAuthorProfile = {
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
};

type SyncedLocalUser = {
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  language: string;
  role: 'ADMIN' | 'USER';
};

function getCommentAuthorName(author?: CommentAuthor | null) {
  const rawName = author?.name?.trim();
  const name = (rawName && !isGeneratedClerkUsername(rawName)) ? rawName : null;
  const rawUsername = author?.username?.trim();
  const username = (rawUsername && !isGeneratedClerkUsername(rawUsername)) ? rawUsername : null;

  const rawEmailFallback = author?.email?.split('@')[0]?.trim();
  const fallbackFromEmail = (rawEmailFallback && !isGeneratedClerkUsername(rawEmailFallback)) ? rawEmailFallback : null;

  return name || username || fallbackFromEmail || "Użytkownik";
}

function isAllowedClerkAvatarUrl(rawUrl?: string | null) {
  if (!rawUrl) return false;

  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();

    return url.protocol === 'https:' && (hostname === 'img.clerk.com' || hostname.endsWith('.clerk.com'));
  } catch {
    return false;
  }
}

function cleanAuthorProfile(profile?: ClerkAuthorProfile | null) {
  const rawName = profile?.name?.trim() || null;
  const name = rawName && !isGeneratedClerkUsername(rawName) ? rawName : null;
  const rawUsername = profile?.username?.trim() || null;
  const username = rawUsername && !isGeneratedClerkUsername(rawUsername) ? rawUsername : null;
  const imageUrl = isAllowedClerkAvatarUrl(profile?.imageUrl) ? profile?.imageUrl?.trim() || null : null;

  return { name, username, imageUrl };
}

function shouldReplaceStoredName(storedName: string | null | undefined, email: string | null | undefined, nextName: string | null) {
  if (!nextName) return false;

  const normalizedStoredName = storedName?.trim() || null;
  const emailLocalPart = email?.split('@')[0]?.trim() || null;

  return !normalizedStoredName
    || normalizedStoredName === 'Użytkownik'
    || isGeneratedClerkUsername(normalizedStoredName)
    || normalizedStoredName === emailLocalPart;
}

async function refreshLocalUserDisplayProfile<T extends SyncedLocalUser>(userId: string, localUser: T, profile?: ClerkAuthorProfile | null): Promise<T> {
  const cleanProfile = cleanAuthorProfile(profile);
  const shouldUpdateName = shouldReplaceStoredName(localUser.name, localUser.email, cleanProfile.name);
  const shouldUpdateImage = !!cleanProfile.imageUrl && cleanProfile.imageUrl !== localUser.imageUrl;
  const shouldUpdateUsername = !!cleanProfile.username && cleanProfile.username !== localUser.username;

  if (!shouldUpdateImage && !shouldUpdateName && !shouldUpdateUsername) {
    return localUser;
  }

  return await UserService.syncUser(
    userId,
    localUser.email,
    shouldUpdateName ? cleanProfile.name : localUser.name,
    shouldUpdateImage ? cleanProfile.imageUrl : localUser.imageUrl,
    undefined,
    localUser.language,
    shouldUpdateUsername ? cleanProfile.username : localUser.username,
    localUser.role
  ) as unknown as T;
}

const postCommentSchema = z.object({
  videoId: z.string(),
  text: z.string().trim().min(1).max(2000).optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().refine((url) => isAllowedMediaUrl(url), "Zablokowany host obrazka").optional().nullable(),
  authorProfile: z.object({
    name: z.string().trim().max(120).optional().nullable(),
    username: z.string().trim().max(120).optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
  }).optional(),
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
  const viewerProfile = {
    name: searchParams.get('viewerName'),
    username: searchParams.get('viewerUsername'),
    imageUrl: searchParams.get('viewerImageUrl'),
  };

  const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 50);

  if (!videoId) {
    return NextResponse.json({ success: false, message: 'videoId is required' }, { status: 400 });
  }

  let userId: string | null = null;
  let sessionClaims: Record<string, unknown> | null | undefined = null;
  try {
      const authData = await auth();
      userId = authData.userId;
      sessionClaims = authData.sessionClaims;
  } catch {}

  try {
    await ensureCommentPinningColumns();

    let internalUserId = null;
    let canModerateComments = false;
    if (userId) {
        let user = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
        if (user) {
          user = await refreshLocalUserDisplayProfile(userId, user, viewerProfile);
        }
        internalUserId = user?.id ?? null;

        if (user?.role === 'ADMIN') {
          canModerateComments = true;
        } else {
          const creator = await prisma.creator.findFirst({
            where: { userId, videos: { some: { id: videoId } } },
            select: { id: true }
          });
          canModerateComments = !!creator;
        }
    }

    const orderBy: Prisma.CommentOrderByWithRelationInput[] = sortBy === 'top'
        ? [
            { pinnedAt: { sort: 'desc', nulls: 'last' } },
            { likes: { _count: 'desc' } },
            { createdAt: 'desc' }
          ]
        : [
            { pinnedAt: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' }
          ];

    const comments = await prisma.comment.findMany({
        where: { videoId, parentId: null },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy,
        include: {
            author: {
                select: { id: true, email: true, name: true, username: true, imageUrl: true, isPatron: true, referralPoints: true, role: true }
            },
            replies: {
                take: 3,
                include: {
                    author: { select: { id: true, email: true, name: true, username: true, imageUrl: true, isPatron: true, referralPoints: true, role: true } },
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
            imageUrl: r.deletedAt ? null : (r.imageUrl || r.author?.imageUrl),
            isLiked: userLikes.has(r.id),
            isDisliked: userDislikes.has(r.id),
            authorName: r.deletedAt ? "Użytkownik" : (getCommentAuthorName(r.author)),
            canPin: false,
        }));

        return {
            ...c,
            text: isDeleted ? "Komentarz usunięty" : c.text,
            author: isDeleted ? null : c.author,
            imageUrl: isDeleted ? null : (c.imageUrl || c.author?.imageUrl),
            isLiked: userLikes.has(c.id),
            isDisliked: userDislikes.has(c.id),
            authorName: isDeleted ? "Użytkownik" : (getCommentAuthorName(c.author)),
            canPin: canModerateComments && !isDeleted && !c.parentId,
            isPinned: !!c.pinnedAt,
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
  let sessionClaims: Record<string, unknown> | null | undefined = null;
  try {
      const authData = await auth();
      userId = authData.userId;
      sessionClaims = authData.sessionClaims;
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
    await ensureCommentPinningColumns();

    let localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
    if (!localUser) {
      return NextResponse.json({ success: false, message: 'Nie udało się zsynchronizować profilu użytkownika.' }, { status: 500 });
    }

    const body = await request.json();
    const result = postCommentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: result.error.flatten() }, { status: 400 });
    }

    const { videoId, text, parentId, imageUrl, authorProfile } = result.data;
    localUser = await refreshLocalUserDisplayProfile(userId, localUser, authorProfile);

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
            author: { select: { id: true, email: true, name: true, username: true, imageUrl: true, isPatron: true, referralPoints: true, role: true } },
            _count: { select: { likes: true, dislikes: true, replies: true } }
        }
    });

    return NextResponse.json({
        success: true,
        comment: {
            ...newComment,
            isLiked: false,
            isDisliked: false,
            authorName: getCommentAuthorName(newComment.author),
            imageUrl: newComment.imageUrl || newComment.author?.imageUrl,
            replies: [],
        }
    }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}


export async function PATCH(request: NextRequest) {
    let userId: string | null = null;
    let sessionClaims: Record<string, unknown> | null | undefined = null;
    try {
        const authData = await auth();
        userId = authData.userId;
        sessionClaims = authData.sessionClaims;
    } catch {
        return NextResponse.json({ error: "Handshake Error" }, { status: 401 });
    }

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const result = z.object({
          commentId: z.string(),
          pinned: z.boolean(),
        }).safeParse(body);

        if (!result.success) {
          return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: result.error.flatten() }, { status: 400 });
        }

        const { commentId, pinned } = result.data;
        const comment = await prisma.comment.findUnique({
          where: { id: commentId },
          include: { video: { select: { id: true, creatorId: true } } }
        });
        if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (comment.parentId) {
          return NextResponse.json({ success: false, message: "Przypinać można tylko główne komentarze." }, { status: 400 });
        }
        if (comment.deletedAt) {
          return NextResponse.json({ success: false, message: "Nie można przypiąć usuniętego komentarza." }, { status: 400 });
        }

        await UserService.getOrCreateUserFromAuth(userId, sessionClaims);

        const actor = await prisma.user.findUnique({
          where: { id: userId },
          include: { creators: { select: { id: true } } }
        });
        const isAdmin = actor?.role === "ADMIN";
        const isVideoCreator = actor?.creators.some(c => c.id === comment.video.creatorId);

        if (!isAdmin && !isVideoCreator) {
            return NextResponse.json({
              error: "Forbidden",
              message: "Comment pinning is limited to video creator and admin."
            }, { status: 403 });
        }

        const updatedComment = await prisma.$transaction(async (tx) => {
          if (!pinned) {
            return tx.comment.update({
              where: { id: commentId },
              data: { pinnedAt: null, pinnedById: null },
            });
          }

          await tx.comment.updateMany({
            where: {
              videoId: comment.video.id,
              parentId: null,
              pinnedAt: { not: null },
              id: { not: commentId },
            },
            data: { pinnedAt: null, pinnedById: null },
          });

          return tx.comment.update({
            where: { id: commentId },
            data: { pinnedAt: new Date(), pinnedById: userId },
          });
        });

        return NextResponse.json({ success: true, isPinned: !!updatedComment.pinnedAt, pinnedAt: updatedComment.pinnedAt });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function DELETE(request: NextRequest) {
    let userId: string | null = null;
    let sessionClaims: Record<string, unknown> | null | undefined = null;
    try {
        const authData = await auth();
        userId = authData.userId;
        sessionClaims = authData.sessionClaims;
    } catch {
        return NextResponse.json({ error: "Handshake Error" }, { status: 401 });
    }

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureCommentPinningColumns();

        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('id');

        if (!commentId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

        const comment = await prisma.comment.findUnique({
          where: { id: commentId },
          include: { video: { select: { creatorId: true } } }
        });
        if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await UserService.getOrCreateUserFromAuth(userId, sessionClaims);

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
