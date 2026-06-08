import { createScopedLogger } from "@/lib/logger";
import { NextRequest } from 'next/server';
import { handleApiError, handleApiResponse } from '@/lib/modules/shared/api-response';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkHealth } from '@/lib/modules/health';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const token = req.headers.get('x-health-token');

  try {
    const ctx = createAppContext({ requestId: requestId || undefined });
    const result = await checkHealth(ctx, token);

    return handleApiResponse(result);
  } catch (error) {
    scopedLogger.error("[HEALTH_CHECK_ERROR]", error);
    return handleApiError(error);
  }
}
