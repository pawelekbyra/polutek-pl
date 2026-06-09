import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { AccessPolicy } from '@/lib/access/access-policy';

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
    const decision = await AccessPolicy.canViewVideo(userId, videoId);

    if (!decision.allowed) {
        scopedLogger.warn(`Access denied for video ${videoId}. Reason: ${decision.reason}`);
    }

    return NextResponse.json({
      hasAccess: decision.allowed,
      requiredTier: decision.requiredTier,
      reason: decision.reason
    });
  } catch (error: unknown) {
    scopedLogger.error("[GET_ACCESS_ERROR]", error);
    return handleApiError(error);
  }
}
