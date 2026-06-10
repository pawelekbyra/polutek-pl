import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { createScopedLogger } from '@/lib/logger';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getAdminDashboardStats } from '@/lib/modules/admin-stats';
import { fromUseCaseResult } from '@/lib/api/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_STATS");
  if (response) return response;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const result = await getAdminDashboardStats(ctx);

    return fromUseCaseResult(result);
  } catch (error: unknown) {
    scopedLogger.error("[GET_ADMIN_STATS_ERROR]", error);
    return fromUseCaseResult({ ok: false, error: error as any });
  }
}
