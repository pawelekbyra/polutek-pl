import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentReportService } from '@/lib/services/comments/comment-report.service';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';

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
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { commentId } = params;

  const rateLimitResult = await rateLimit({ key: `reports:${userId}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimitResult.success) return NextResponse.json({ success: false, message: "Zbyt wiele zgłoszeń. Spróbuj później." }, { status: 429 });

  try {
    const localUser = await UserService.getOrCreateUserFromAuth(userId, sessionClaims);
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
