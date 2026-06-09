import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { z } from 'zod';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { updateComment, deleteComment } from '@/lib/modules/comments';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();

  if (actor.type === 'guest') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { commentId } = params;

  try {
    const ctx = createAppContext({ actor });
    const body = await request.json();
    const { text } = z.object({ text: z.string().trim().min(1) }).parse(body);

    const result = await updateComment({ commentId, text }, ctx);

    if (!result.ok) {
      if (result.error.type === 'NOT_FOUND') return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (result.error.type === 'FORBIDDEN') return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, comment: result.data });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_PATCH_ERROR]', error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();

  if (actor.type === 'guest') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { commentId } = params;

  try {
    const ctx = createAppContext({ actor });
    const result = await deleteComment({ commentId }, ctx);

    if (!result.ok) {
      if (result.error.type === 'NOT_FOUND') return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (result.error.type === 'FORBIDDEN') return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error('[COMMENT_DELETE_ERROR]', error);
    return handleApiError(error);
  }
}
