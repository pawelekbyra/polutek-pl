import { createScopedLogger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { getAdminVideoDetails, updateAdminVideo } from "@/lib/modules/video";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("UPDATE_ADMIN_VIDEO");
  if (response) return response;

  try {
    const body = await req.json();
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });
    const result = await updateAdminVideo({ id: params.id, ...body }, ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi(
    "GET_ADMIN_VIDEO_DETAILS",
  );
  if (response) return response;

  const idOrSlug = params.id;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({
      actor,
      requestId: requestId || undefined,
    });

    const result = await getAdminVideoDetails({ idOrSlug }, ctx);

    return fromUseCaseResult(result);
  } catch (error: unknown) {
    scopedLogger.error("[GET_ADMIN_VIDEO_DETAILS_ERROR]", error);
    return handleApiError(error);
  }
}
