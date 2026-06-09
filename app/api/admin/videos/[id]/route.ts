import { createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { VideosDiagnosticsService } from '@/lib/services/admin/videos-diagnostics.service';
import { isUuid } from '@/lib/utils/uuid';
import { getVideoById } from '@/lib/modules/video';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_VIDEO_DETAILS");
  if (response) return response;

  let videoId = params.id;

  try {
    if (!isUuid(videoId)) {
        const found = await prisma.video.findUnique({ where: { slug: videoId }, select: { id: true } });
        if (found) videoId = found.id;
        else return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await getVideoById(videoId, ctx);

    if (!result.ok) return fromUseCaseResult(result);

    const diagnostics = await VideosDiagnosticsService.diagnoseVideo(videoId);

    const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'Video', targetId: videoId },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    // Merge module DTO with admin-only details (diagnostics, audit)
    return NextResponse.json({
        ...result.data,
        diagnostics,
        auditLogs
    });
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_VIDEO_DETAILS_ERROR]", error);
      return handleApiError(error);
  }
}
