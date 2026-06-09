import { createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { VideosDiagnosticsService } from '@/lib/services/admin/videos-diagnostics.service';
import { getAdminVideoById } from '@/lib/modules/video';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_VIDEO_DETAILS");
  if (response) return response;

  const idOrSlug = params.id;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });

    // Core video lookup is now main-channel scoped through the video module.
    const result = await getAdminVideoById({ idOrSlug }, ctx);

    if (!result.ok) return fromUseCaseResult(result);

    const video = result.data;
    const videoId = video.id;

    // R6 blocker: admin video diagnostics/audit details still use legacy services/direct Prisma.
    // Core video lookup is main-channel scoped through video module.
    const diagnostics = await VideosDiagnosticsService.diagnoseVideo(videoId);

    const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'Video', targetId: videoId },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    // Merge module DTO with admin-only details (diagnostics, audit)
    return NextResponse.json({
        ...video,
        diagnostics,
        auditLogs
    });
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_VIDEO_DETAILS_ERROR]", error);
      return handleApiError(error);
  }
}
