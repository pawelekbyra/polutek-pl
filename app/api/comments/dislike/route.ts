import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { AccessPolicy } from '@/lib/access/access-policy';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * API Route for toggling a 'Dislike' on a comment.
 * Mutually exclusive with 'Like'.
 */
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
        const authData = await auth();
      userId = authData.userId;
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
    await UserService.getOrCreateUser(userId);

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
        // 1. Remove existing like if any
        await tx.commentLike.deleteMany({
            where: { userId, commentId }
        });

        // 2. Toggle Dislike
        const existingDislike = await tx.commentDislike.findUnique({
            where: { userId_commentId: { userId, commentId } }
        });

        if (existingDislike) {
            await tx.commentDislike.delete({ where: { id: existingDislike.id } });
            return NextResponse.json({ success: true, liked: false, disliked: false });
        } else {
            await tx.commentDislike.create({ data: { userId, commentId } });
            return NextResponse.json({ success: true, liked: false, disliked: true });
        }
    });
  } catch (error: unknown) {
    console.error('[COMMENT_DISLIKE_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Wystąpił błąd podczas oceniania komentarza.' }, { status: 500 });
  }
}
