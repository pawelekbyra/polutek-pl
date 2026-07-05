import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getAdminVideoMediaState } from "@/lib/modules/video";
import { VideoDistributionPlanService } from "@/lib/modules/video/application/video-distribution-plan.service";
import { VideoProviderJobService } from "@/lib/modules/video/application/video-provider-job.service";
import { getCorrelationId } from "@/lib/utils/correlation";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_DISTRIBUTION_PLAN");
  if (response) return response;

  try {
    const body = await req.json();
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
    const planService = new VideoDistributionPlanService();
    const plan = await planService.createOrReplaceActivePlan({
      videoId: params.id,
      originalId: body.originalId ?? null,
      strategy: body.strategy,
      publishAfterReady: body.publishAfterReady,
      createdByAdminId: adminUserId!,
    }, ctx);

    const jobService = new VideoProviderJobService();
    const jobs = await jobService.enqueueImportJobsForPlan({ planId: plan.id }, ctx);
    for (const job of jobs) {
      await jobService.startQueuedJob({ jobId: job.id }, ctx);
    }

    const mediaState = await getAdminVideoMediaState({ videoId: params.id }, ctx);
    return fromUseCaseResult(mediaState);
  } catch (error) {
    return handleApiError(error);
  }
}
