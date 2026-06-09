import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createScopedLogger } from '@/lib/logger';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';

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
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });

    const result = await checkVideoAccess({ videoIdOrSlug: videoId }, ctx);

    // checkVideoAccess always returns ok result with access decision
    if (!result.ok) {
        throw new Error("Unexpected checkVideoAccess failure");
    }
    const decision = result.data;

    if (!decision.hasAccess) {
        scopedLogger.warn(`Access denied for video ${videoId}. Reason: ${decision.reason}`);
    }

    return NextResponse.json(decision);
  } catch (error: unknown) {
    scopedLogger.error("[GET_ACCESS_ERROR]", error);
    return handleApiError(error);
  }
}
