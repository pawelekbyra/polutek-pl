import { createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { VideosDiagnosticsService } from '@/lib/services/admin/videos-diagnostics.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_VIDEO_DETAILS");
  if (response) return response;

  const videoId = params.id;

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        creator: true,
        asset: true,
        _count: {
          select: {
            comments: true,
            videoLikes: true,
            videoDislikes: true,
            playbackSessions: true
          }
        }
      }
    });

    if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const diagnostics = await VideosDiagnosticsService.diagnoseVideo(videoId);

    const auditLogs = await prisma.auditLog.findMany({
        where: { targetType: 'Video', targetId: videoId },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

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
