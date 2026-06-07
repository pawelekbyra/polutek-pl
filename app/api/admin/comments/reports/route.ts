import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { CommentReportService } from '@/lib/services/comments/comment-report.service';
import { CommentReportStatus } from '@prisma/client';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { response } = await requireAdminForApi("GET_COMMENT_REPORTS");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as CommentReportStatus || undefined;

  try {
    const reports = await CommentReportService.getReports(status);
    return NextResponse.json(reports);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
