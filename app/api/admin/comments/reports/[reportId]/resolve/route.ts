import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { CommentReportService } from '@/lib/services/comments/comment-report.service';
import { CommentReportStatus } from '@prisma/client';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const { adminUserId, response } = await requireAdminForApi("RESOLVE_COMMENT_REPORT");
  if (response) return response;

  const { status } = await req.json();
  if (!['DISMISSED', 'ACTION_TAKEN'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const report = await CommentReportService.resolveReport(params.reportId, adminUserId!, status as CommentReportStatus);
    return NextResponse.json(report);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
