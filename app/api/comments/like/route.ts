import { logger, createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentReactionService } from '@/lib/services/comments/comment-reaction.service';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
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
          message: 'Błąd weryfikacji sesji.'
      }, { status: 500 });
  }

  if (!userId) return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });

  const rateLimitResult = await rateLimit({ key: `reactions:${userId}`, limit: 60, windowMs: 60 * 1000 });
  if (!rateLimitResult.success) return NextResponse.json({ success: false, message: "Zbyt wiele reakcji. Odczekaj chwilę." }, { status: 429 });

  try {
    const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
    if (!localUser) return NextResponse.json({ success: false, message: 'Nie udało się zsynchronizować profilu użytkownika.' }, { status: 500 });

    const { commentId } = await request.json();
    if (!commentId) return NextResponse.json({ success: false, message: 'Brak ID komentarza.' }, { status: 400 });

    const decision = await CommentAccessService.canReact(userId, commentId);
    if (!decision.allowed) {
      return NextResponse.json({
        success: false,
        message: decision.reason,
        requiredTier: 'requiredTier' in decision ? decision.requiredTier : undefined
      }, { status: 403 });
    }

    const result = await CommentReactionService.toggleLike(localUser.id, commentId);
    return NextResponse.json({ success: true, liked: result.liked, disliked: false });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_LIKE_ERROR]', error);
    return handleApiError(error);
  }
}
