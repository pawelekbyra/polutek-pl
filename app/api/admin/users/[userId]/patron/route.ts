import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { grantPatron, revokePatron } from "@/lib/modules/patron";
import { syncClerkAccess } from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";

type Context = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, props: Context) {
  const params = await props.params;
  const requestId = request.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);

  const { adminUserId, response: authResponse } = await requireAdminForApi(
    "PATCH_ADMIN_USER_PATRON",
  );
  if (authResponse) return authResponse;

  const ctx = createAppContext({ type: "admin", userId: adminUserId! });

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    const reason = (body?.reason || body?.note || "").trim();

    if (!reason) {
      return NextResponse.json(
        { error: "Reason is required for manual patron status change." },
        { status: 400 },
      );
    }

    if (action === "grant") {
      const result = await grantPatron(
        {
          userId: params.userId,
          source: "admin",
          grantedByUserId: adminUserId!,
          note: reason,
        },
        ctx,
      );

      if (!result.ok) return handleApiError(result.error);

      await syncClerkAccess(
        params.userId,
        true,
        result.data.normalizedTotal,
      ).catch((error) => {
        scopedLogger.error("[ADMIN_PATRON_GRANT_CLERK_SYNC_ERROR]", error);
      });

      return NextResponse.json({
        isPatron: true,
        patronSince: result.data.patronSince,
        patronSource: result.data.patronSource,
      });
    }

    if (action === "revoke") {
      const result = await revokePatron(
        {
          userId: params.userId,
          revokedByUserId: adminUserId!,
          note: reason,
        },
        ctx,
      );

      if (!result.ok) return handleApiError(result.error);

      await syncClerkAccess(
        params.userId,
        false,
        result.data.normalizedTotal,
      ).catch((error) => {
        scopedLogger.error("[ADMIN_PATRON_REVOKE_CLERK_SYNC_ERROR]", error);
      });

      return NextResponse.json({
        isPatron: false,
        patronSince: null,
        patronSource: null,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    scopedLogger.error("[ADMIN_PATRON_PATCH_ERROR]", error);
    return handleApiError(error);
  }
}
