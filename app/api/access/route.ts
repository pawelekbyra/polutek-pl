import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { VideoContentService as ContentService } from '@/lib/services/content/video.service';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  try {
    const { userId } = await auth();
    const { hasAccess, requiredTier, reason } = await ContentService.getVideoAccess(userId, videoId);

    if (!hasAccess) {
        scopedLogger.warn(`Access denied for video ${videoId}. Reason: ${reason}`);
    }

    return NextResponse.json({
      hasAccess,
      requiredTier,
      reason
    });
  } catch (error: unknown) {
    scopedLogger.error("[GET_ACCESS_ERROR]", error);
    return handleApiError(error);
  }
}
