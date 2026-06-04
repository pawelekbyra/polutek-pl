import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { AccessPolicy } from '@/lib/access/access-policy';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * API Route for toggling a 'Like' on a comment.
 * Mutually exclusive with 'Dislike'.
 */
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let sessionClaims: Record<string, unknown> | null | undefined = null;
  try {
      const authData = await auth();
      userId = authData.userId;
      sessionClaims = authData.sessionClaims;
  } catch (e) {
      return NextResponse.json({
          success: false,
          error: "CLERK_ERROR",
          message: 'Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API w panelu Vercel.'
      }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });
  }

  // Rate Limiting: 60 reactions per minute
  const rateLimitResult = await rateLimit({
      key: `reactions:${userId}`,
      limit: 60,
      windowMs: 60 * 1000
  });

  if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, message: "Zbyt wiele reakcji. Odczekaj chwilę." }, { status: 429 });
  }

  try {
    const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
    if (!localUser) {
      return NextResponse.json({ success: false, message: 'Nie udało się zsynchronizować profilu użytkownika.' }, { status: 500 });
    }

    const { commentId } = await request.json();

    if (!commentId) {
      return NextResponse.json({ success: false, message: 'Brak ID komentarza.' }, { status: 400 });
    }

    const decision = await AccessPolicy.canReactToComment(userId, commentId);
    if (!decision.allowed) {
      return NextResponse.json(
        { success: false, message: decision.reason, requiredTier: decision.requiredTier },
        { status: 403 }
      );
    }

    return await prisma.$transaction(async (tx) => {
        // 1. Remove an existing dislike when present
        await tx.commentDislike.deleteMany({
            where: { userId: localUser.id, commentId }
        });

        // 2. Toggle Like
        const existingLike = await tx.commentLike.findUnique({
            where: { userId_commentId: { userId: localUser.id, commentId } }
        });

        if (existingLike) {
            await tx.commentLike.delete({ where: { id: existingLike.id } });
            return NextResponse.json({ success: true, liked: false, disliked: false });
        } else {
            await tx.commentLike.create({ data: { userId: localUser.id, commentId } });
            return NextResponse.json({ success: true, liked: true, disliked: false });
        }
    });
  } catch (error: unknown) {
    logger.error('[COMMENT_LIKE_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Wystąpił błąd podczas oceniania komentarza.' }, { status: 500 });
  }
}
