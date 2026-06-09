import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { listVideoComments, createVideoComment } from '@/lib/modules/comments';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { isAllowedCommentImageUrl } from '@/lib/blob';

export const dynamic = 'force-dynamic';

const postCommentSchema = z.object({
  text: z.string().trim().min(1).optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().refine((url) => isAllowedCommentImageUrl(url), "Zablokowany host obrazka").optional().nullable(),
}).refine(data => data.text || data.imageUrl, {
  message: "Treść komentarza lub obrazek jest wymagany",
  path: ["text"]
});

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { searchParams } = new URL(request.url);
  const videoId = params.id;

  const sortBy = (searchParams.get('sortBy') as any) || 'newest';
  const cursor = searchParams.get('cursor') || undefined;
  const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 50);

  const actor = await getActorFromAuth();

  try {
    const ctx = createAppContext({ actor });
    const result = await listVideoComments({ videoId, sortBy, cursor, limit }, ctx);

    if (!result.ok) {
        if (result.error.type === 'NOT_FOUND') {
            return NextResponse.json({ success: false, message: result.error.message }, { status: 404 });
        }
        return NextResponse.json({ success: false, message: result.error.message }, { status: 403 });
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

  if (actor.type === 'guest' || !('userId' in actor)) {
      return NextResponse.json({ success: false, message: 'Musisz być zalogowany.' }, { status: 401 });
  }

  const userId = actor.userId;
  const videoId = params.id;

  const rateLimitResult = await rateLimit({ key: `comments:${userId}`, limit: 5, windowMs: 60 * 1000 });
  if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, message: "Zbyt dużo komentarzy. Spróbuj za chwilę." }, { status: 429 });
  }

  try {
    const resultJson = postCommentSchema.safeParse(await request.json());
    if (!resultJson.success) {
        return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.', errors: resultJson.error.flatten() }, { status: 400 });
    }

    const { text, parentId, imageUrl } = resultJson.data;

    const ctx = createAppContext({ actor });
    const result = await createVideoComment({
        videoId,
        text: text || '',
        parentId,
        imageUrl
    }, ctx);

    if (!result.ok) {
        const status = result.error.type === 'UNAUTHORIZED' ? 401 : result.error.type === 'FORBIDDEN' ? 403 : 400;
        return NextResponse.json({ success: false, message: result.error.message }, { status });
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
