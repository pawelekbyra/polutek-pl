import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getAdminVideoMediaState } from "@/lib/modules/video";
import { VideoProviderJobService } from "@/lib/modules/video";
import { getCorrelationId } from "@/lib/utils/correlation";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string; jobId: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_PROVIDER_JOB_RETRY");
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
    const jobService = new VideoProviderJobService();
    await jobService.retryJob({ jobId: params.jobId, requestedByAdminId: adminUserId!, force: Boolean(body.force) }, ctx);
    const mediaState = await getAdminVideoMediaState({ videoId: params.id }, ctx);
    return fromUseCaseResult(mediaState);
  } catch (error) {
    return handleApiError(error);
  }
}
