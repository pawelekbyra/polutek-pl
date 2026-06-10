import { NextResponse, NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { resyncSubscribers } from '@/lib/modules/channel';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { requireAdminForApi } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { response, adminUserId } = await requireAdminForApi('RESYNC_SUBSCRIBERS');
  if (response) return response;

  try {
    const requestId = req.headers.get('x-request-id') || undefined;
    const ctx = createAppContext({
        actor: { type: 'admin', userId: adminUserId! },
        requestId
    });

    const result = await resyncSubscribers(ctx);

    return fromUseCaseResult(result, (data) =>
        NextResponse.json({ success: true, updated: data.updated })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
