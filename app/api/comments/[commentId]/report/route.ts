import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentReportService } from '@/lib/services/comments/comment-report.service';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { GetOrCreateUserUseCase } from '@/lib/modules/users';

export const dynamic = 'force-dynamic';

const reportSchema = z.object({
  reason: z.enum(['SPAM', 'HARASSMENT', 'HATE', 'NSFW', 'SPOILER', 'OTHER']),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();
  if (actor.type === 'guest' || !('userId' in actor)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  const userId = actor.userId;

  const { commentId } = params;

  const rateLimitResult = await rateLimit({ key: `reports:${userId}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimitResult.success) return NextResponse.json({ success: false, message: "Zbyt wiele zgłoszeń. Spróbuj później." }, { status: 429 });

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
    const result = reportSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });

    await CommentReportService.report(localUser.id, commentId, result.data.reason, result.data.note);

    return NextResponse.json({ success: true, message: "Dziękujemy, zgłoszenie zostało zapisane." });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_REPORT_ERROR]', error);
    return handleApiError(error);
  }
}
