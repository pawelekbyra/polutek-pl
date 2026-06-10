import { NextResponse, NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getActorFromAuth } from '@/lib/api/auth';
import { resyncSubscribers } from '@/lib/modules/channel';
import { fromUseCaseResult } from '@/lib/api/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const requestId = req.headers.get('x-request-id') || undefined;
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId });

    const result = await resyncSubscribers(ctx);

    return fromUseCaseResult(result, (data) =>
        NextResponse.json({ success: true, updated: data.updated })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
