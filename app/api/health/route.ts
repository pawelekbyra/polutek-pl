import { createScopedLogger } from "@/lib/logger";
import { NextRequest } from 'next/server';
import { handleApiError, handleApiResponse } from '@/lib/api/api-response';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkHealth } from '@/lib/modules/health';
import { getActorFromAuth } from "@/lib/api/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const token = req.headers.get('x-health-token');

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ requestId: requestId || undefined, actor });
    const result = await checkHealth(ctx, token);

    // Without the diagnostic token this is liveness only. The authorized readiness response
    // must use a failing HTTP status when a dependency check fails, so external probes can detect it.
    return handleApiResponse(result, result.ok ? 200 : 503);
  } catch (error) {
    scopedLogger.error("[HEALTH_CHECK_ERROR]", error);
    return handleApiError(error);
  }
}
