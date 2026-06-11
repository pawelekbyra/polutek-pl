import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { listCommentReports } from '@/lib/modules/comments';
import { CommentReportStatus } from '@prisma/client';
import { handleApiError } from '@/lib/errors';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getActorFromAuth } from '@/lib/api/auth';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const { response } = await requireAdminForApi("GET_COMMENT_REPORTS");
  if (response) return response;
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') as CommentReportStatus) || undefined;
  try {
    const actor = await getActorFromAuth();
    const result = await listCommentReports(status, createAppContext({ actor }));
    if (result.ok) return NextResponse.json(result.data);
    return NextResponse.json({ error: result.error.message }, { status: result.error.type === 'UNAUTHORIZED' ? 401 : 500 });
  } catch (error: unknown) { return handleApiError(error); }
}
