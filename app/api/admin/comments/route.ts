import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createAppContextFromRequest } from '@/lib/api/app-context-factory';
import { listAdminComments } from '@/lib/modules/comments';
import { CommentStatus } from '@prisma/client';
import { requireAdminForApi } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { response } = await requireAdminForApi("GET_ADMIN_COMMENTS");
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || undefined;
    const status = searchParams.get('status') as CommentStatus | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const ctx = await createAppContextFromRequest();
    const result = await listAdminComments({ q, status, limit }, ctx);

    if (!result.ok) {
        return NextResponse.json({ success: false, message: result.error.message }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      comments: result.data
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
