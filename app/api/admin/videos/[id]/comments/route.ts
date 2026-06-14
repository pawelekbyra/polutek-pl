import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createAppContextFromRequest } from '@/lib/api/app-context-factory';
import { listVideoComments } from '@/lib/modules/comments';
import { requireAdminForApi } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireAdminForApi("GET_ADMIN_VIDEO_COMMENTS");
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const sortBy = (searchParams.get('sortBy') as
any) || 'newest';
    const cursor = searchParams.get('cursor') || undefined;
    const limit = 50;

    const ctx = await createAppContextFromRequest();
    const result = await listVideoComments({
        videoId: params.id,
        sortBy,
        cursor,
        limit
    }, ctx);

    if (!result.ok) {
        const status = result.error.type === 'NOT_FOUND' ? 404 : 403;
        return NextResponse.json({ success: false, message: result.error.message }, { status });
    }

    return NextResponse.json({
        success: true,
        comments: result.data.comments,
        totalCount: result.data.totalCount,
        nextCursor: result.data.nextCursor
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
