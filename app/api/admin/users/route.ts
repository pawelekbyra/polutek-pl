import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { parseUserQueryParams } from "@/lib/admin/query-parser";
import { listAdminUsers } from "@/lib/modules/users";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_USERS");
  if (response) return response;

  const options = parseUserQueryParams(req);

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const result = await listAdminUsers(options, ctx);

    return NextResponse.json(result);
  } catch (error: unknown) {
    scopedLogger.error("[GET_ADMIN_USERS_ERROR]", error);
    return handleApiError(error);
  }
}
