import { createScopedLogger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { getAdminUserDetails } from "@/lib/modules/users";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi(
    "GET_ADMIN_USER_DETAILS",
  );
  if (response) return response;

  const userId = params.userId;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const result = await getAdminUserDetails(userId, ctx);

    return fromUseCaseResult(result);
  } catch (error: unknown) {
    scopedLogger.error("[GET_ADMIN_USER_DETAILS_ERROR]", error);
    return handleApiError(error);
  }
}
