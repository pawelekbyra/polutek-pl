import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getAdminVideoMediaState } from "@/lib/modules/video";
import { VideoPlaybackRouteService } from "@/lib/modules/video";
import { getCorrelationId } from "@/lib/utils/correlation";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminPlaybackRouteSchema } from "@/lib/api/admin-schemas";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_VIDEO_PLAYBACK_ROUTE");
  if (response) return response;

  try {
    const parsed = await parseAdminBody(req, adminPlaybackRouteSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
    await new VideoPlaybackRouteService().activateRoute({ videoId: params.id, assetId: body.assetId, activatedBy: "ADMIN", reason: "admin-selected-active-source" }, ctx);
    const mediaState = await getAdminVideoMediaState({ videoId: params.id }, ctx);
    return fromUseCaseResult(mediaState);
  } catch (error) {
    return handleApiError(error);
  }
}
