import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getCommentContext } from '@/lib/modules/comments';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const actor = await getActorFromAuth();

  try {
    const ctx = createAppContext({ actor });
    const result = await getCommentContext({ commentId: params.commentId }, ctx);

    if (!result.ok) {
        const status = result.error.type === 'NOT_FOUND' ? 404 : 403;
        return NextResponse.json({ success: false, message: result.error.message }, { status });
    }

    return NextResponse.json({
      success: true,
      ...result.data
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
