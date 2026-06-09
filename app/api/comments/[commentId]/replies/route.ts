import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { listCommentReplies } from '@/lib/modules/comments';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const actor = await getActorFromAuth();
  const { commentId } = params;

  try {
    const ctx = createAppContext({ actor });
    const result = await listCommentReplies({ commentId }, ctx);

    if (!result.ok) {
      if (result.error.type === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ error: result.error.message }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      replies: result.data.replies
    });
  } catch (error: unknown) {
    scopedLogger.error('[GET_REPLIES_ERROR]', error);
    return handleApiError(error);
  }
}
