import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getAdminVideoMediaState, VideoDistributionOrchestratorService, VideoProviderReconcilerService } from "@/lib/modules/video";
import { getCorrelationId } from "@/lib/utils/correlation";

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_RECONCILE");
  if (response) return response;
  try {
    const ctx = createAppContext({ requestId: getCorrelationId() ?? undefined, actor: { type: "admin", userId: adminUserId! } });
    // Sync stale/stuck provider jobs for this video against real provider state first,
    // so a missed webhook (or an import that never started) is repaired on demand.
    await new VideoProviderReconcilerService().reconcilePendingProviderJobs({ videoId: params.id, olderThanSeconds: 30 }, ctx);
    await new VideoDistributionOrchestratorService().reconcileVideoDistribution({ videoId: params.id, reason: "MANUAL" }, ctx);
    return fromUseCaseResult(await getAdminVideoMediaState({ videoId: params.id }, ctx));
  } catch (error) {
    return handleApiError(error);
  }
}
