import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { pinComment, unpinComment } from '@/lib/modules/comments';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();
  const { commentId } = params;

  try {
    const ctx = createAppContext({ actor });
    const result = await pinComment({ commentId }, ctx);

    if (!result.ok) {
        const status = result.error.type === 'UNAUTHORIZED' ? 401 : result.error.type === 'FORBIDDEN' ? 403 : result.error.type === 'NOT_FOUND' ? 404 : 400;
        return NextResponse.json({ success: false, message: result.error.message }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[PIN_COMMENT_ERROR]", error);
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
  const { commentId } = params;

  try {
    const ctx = createAppContext({ actor });
    const result = await unpinComment({ commentId }, ctx);

    if (!result.ok) {
        const status = result.error.type === 'UNAUTHORIZED' ? 401 : result.error.type === 'FORBIDDEN' ? 403 : result.error.type === 'NOT_FOUND' ? 404 : 400;
        return NextResponse.json({ success: false, message: result.error.message }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[UNPIN_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}
