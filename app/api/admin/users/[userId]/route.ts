import { createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { deleteUserAsAdmin, getAdminUserDetails } from "@/lib/modules/users";
import { fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminUserDeleteSchema } from "@/lib/api/admin-schemas";
import { requireRecentAdminSignIn } from "@/lib/api/admin-recent-sign-in";

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

/**
 * Deletes another user's account (same cleanup as self-service deletion). Rate limited (5/min, middleware),
 * needs a sign-in from the last 10 minutes (403 REAUTH_REQUIRED) and `{ confirmEmail }` matching the user's
 * address. Refusals: 403 SELF_ACTION_FORBIDDEN, 404 USER_NOT_FOUND, 409 USER_ALREADY_DELETED / TARGET_IS_ADMIN,
 * 400 CONFIRM_EMAIL_MISMATCH. Each error carries a Polish `message` for the admin.
 */
export async function DELETE(req: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("DELETE_ADMIN_USER");
  if (response) return response;

  try {
    const stale = await requireRecentAdminSignIn(adminUserId!);
    if (stale) return stale;

    const parsed = await parseAdminBody(req, adminUserDeleteSchema, { allowEmpty: true });
    if (!parsed.ok) return parsed.response;

    const ctx = createAppContext({
      actor: { type: "admin", userId: adminUserId! },
      requestId: requestId || undefined,
    });
    const result = await deleteUserAsAdmin(ctx, {
      adminUserId: adminUserId!,
      userId: params.userId,
      confirmEmail: parsed.data.confirmEmail,
    });
    if (!result.ok) return handleApiError(result.error);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[DELETE_ADMIN_USER_ERROR]", error);
    return handleApiError(error);
  }
}
