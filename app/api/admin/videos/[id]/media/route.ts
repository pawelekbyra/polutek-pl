import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getAdminVideoMediaState } from "@/lib/modules/video";
import { getCorrelationId } from "@/lib/utils/correlation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_VIDEO_MEDIA_STATE");
  if (response) return response;

  const ctx = createAppContext({
    actor: { type: "admin", userId: adminUserId! },
    requestId: getCorrelationId() ?? undefined,
  });

  const result = await getAdminVideoMediaState({ videoId: params.id }, ctx);
  return fromUseCaseResult(result);
}
