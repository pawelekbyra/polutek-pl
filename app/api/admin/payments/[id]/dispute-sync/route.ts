import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { adminDisputeSync } from "@/lib/modules/payments";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { adminUserId, response } = await requireAdminForApi("ADMIN_DISPUTE_SYNC");
  if (response) return response;

  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);

  try {
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const result = await adminDisputeSync({ paymentId: params.id }, ctx);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode ?? 400 });
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_DISPUTE_SYNC_ERROR]", error);
    return handleApiError(error);
  }
}
