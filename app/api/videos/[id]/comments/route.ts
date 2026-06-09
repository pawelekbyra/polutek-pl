import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { listVideoComments, createVideoComment } from '@/lib/modules/comments';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const postCommentSchema = z.object({
  text: z.string().trim().min(1),
  parentId: z.string().optional().nullable(),
});

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();
  const videoIdOrSlug = params.id;

  try {
    const ctx = createAppContext({ actor });
    const result = await listVideoComments({ videoIdOrSlug }, ctx);

    if (!result.ok) {
      if (result.error.type === 'NOT_FOUND') return NextResponse.json({ error: "Video not found" }, { status: 404 });
      return NextResponse.json({ error: result.error.message }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      ...result.data
    });
  } catch (error: unknown) {
    scopedLogger.error("[GET_COMMENTS_ERROR]", error);
    return handleApiError(error);
  }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();

  if (actor.type === 'guest') {
    return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });
  }

  const videoIdOrSlug = params.id;
  const userId = (actor as any).userId;

  const rateLimitResult = await rateLimit({ key: `comments:${userId}`, limit: 5, windowMs: 60 * 1000 });
  if (!rateLimitResult.success) {
    return NextResponse.json({ success: false, message: "Zbyt dużo komentarzy. Spróbuj za chwilę." }, { status: 429 });
  }

  try {
    const ctx = createAppContext({ actor });
    const body = await request.json();
    const parsed = postCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: parsed.error.flatten() }, { status: 400 });
    }

    const result = await createVideoComment({
      videoIdOrSlug,
      text: parsed.data.text,
      parentId: parsed.data.parentId || undefined
    }, ctx);

    if (!result.ok) {
      if (result.error.type === 'NOT_FOUND') return NextResponse.json({ error: "Video not found" }, { status: 404 });
      if (result.error.type === 'FORBIDDEN') return NextResponse.json({ success: false, message: result.error.message }, { status: 403 });
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({
        success: true,
        comment: result.data
    }, { status: 201 });
  } catch (error: unknown) {
    scopedLogger.error("[POST_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}
