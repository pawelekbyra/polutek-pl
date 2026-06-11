import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { resolveCommentReport } from '@/lib/modules/comments';
import { CommentReportStatus } from '@prisma/client';
import { handleApiError } from '@/lib/errors';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getActorFromAuth } from '@/lib/api/auth';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: { params: { reportId: string } }) {
  const { response } = await requireAdminForApi("RESOLVE_COMMENT_REPORT");
  if (response) return response;
  try {
    const { status } = await req.json();
    if (!['DISMISSED', 'ACTION_TAKEN'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    const actor = await getActorFromAuth();
    const result = await resolveCommentReport(params.reportId, status as CommentReportStatus, createAppContext({ actor }));
    if (result.ok) return NextResponse.json(result.data);
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  } catch (error: unknown) { return handleApiError(error); }
}
