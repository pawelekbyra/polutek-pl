import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { listAdminComments } from '@/lib/modules/comments';
import { CommentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await getActorFromAuth();

  if (actor.type !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || undefined;
    const status = searchParams.get('status') as CommentStatus | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const ctx = createAppContext({ actor });
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
