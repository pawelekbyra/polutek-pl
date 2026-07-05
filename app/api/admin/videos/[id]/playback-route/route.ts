import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getAdminVideoMediaState } from "@/lib/modules/video";
import { VideoPlaybackRouteService } from "@/lib/modules/video/application/video-playback-route.service";
import { getCorrelationId } from "@/lib/utils/correlation";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_VIDEO_PLAYBACK_ROUTE");
  if (response) return response;

  try {
    const body = await req.json();
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
    await new VideoPlaybackRouteService().activateRoute({ videoId: params.id, assetId: body.assetId, activatedBy: "ADMIN", reason: "admin-selected-active-source" }, ctx);
    const mediaState = await getAdminVideoMediaState({ videoId: params.id }, ctx);
    return fromUseCaseResult(mediaState);
  } catch (error) {
    return handleApiError(error);
  }
}
