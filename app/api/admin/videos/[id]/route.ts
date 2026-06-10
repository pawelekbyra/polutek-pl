import { createScopedLogger } from "@/lib/logger";
import { NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { getAdminVideoDetails } from '@/lib/modules/video';
import { fromUseCaseResult } from '@/lib/api/api-response';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getCorrelationId } from "@/lib/utils/correlation";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_VIDEO_DETAILS");
  if (response) return response;

  const idOrSlug = params.id;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({
        actor,
        requestId: requestId || undefined
    });

    const result = await getAdminVideoDetails({ idOrSlug }, ctx);

    return fromUseCaseResult(result);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_VIDEO_DETAILS_ERROR]", error);
      return handleApiError(error);
  }
}
