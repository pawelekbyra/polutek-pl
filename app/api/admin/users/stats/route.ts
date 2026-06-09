import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { getAdminUsersStats } from '@/lib/modules/users';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_USERS_STATS");
  if (response) return response;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const stats = await getAdminUsersStats(ctx);

    return NextResponse.json(stats);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_USERS_STATS_ERROR]", error);
      return handleApiError(error);
  }
}
