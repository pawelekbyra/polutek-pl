import { createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { changeUserRoleAsAdmin } from "@/lib/modules/users";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminUserRoleSchema } from "@/lib/api/admin-schemas";
import { requireRecentAdminSignIn } from "@/lib/api/admin-recent-sign-in";

export const dynamic = "force-dynamic";

/**
 * Grants or removes the ADMIN role: body `{ role: "ADMIN" | "USER" }`. Rate limited (5/min, middleware) and
 * needs a sign-in from the last 10 minutes (403 REAUTH_REQUIRED). Refusals: 403 SELF_ACTION_FORBIDDEN,
 * 404 USER_NOT_FOUND, 409 USER_ALREADY_DELETED / LAST_ADMIN / EMAIL_NOT_VERIFIED. Same role again = 200, no change.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_USER_ROLE");
  if (response) return response;

  try {
    const stale = await requireRecentAdminSignIn(adminUserId!);
    if (stale) return stale;

    const parsed = await parseAdminBody(req, adminUserRoleSchema, { errorMessage: "Invalid role" });
    if (!parsed.ok) return parsed.response;

    const ctx = createAppContext({
      actor: { type: "admin", userId: adminUserId! },
      requestId: requestId || undefined,
    });
    const result = await changeUserRoleAsAdmin(ctx, {
      adminUserId: adminUserId!,
      userId: params.userId,
      role: parsed.data.role,
    });
    if (!result.ok) return handleApiError(result.error);
    return NextResponse.json(result.data);
  } catch (error: unknown) {
    scopedLogger.error("[PATCH_ADMIN_USER_ROLE_ERROR]", error);
    return handleApiError(error);
  }
}
