import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { adminRefund } from "@/lib/modules/payments";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { adminUserId, response } = await requireAdminForApi("ADMIN_REFUND_PAYMENT");
  if (response) return response;

  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);

  try {
    let body: { amountMinor?: number; reason?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body = full refund
    }

    const { id } = await params;
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const result = await adminRefund(
      { paymentId: id, amountMinor: body.amountMinor, reason: body.reason },
      ctx
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode ?? 400 });
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_REFUND_PAYMENT_ERROR]", error);
    return handleApiError(error);
  }
}
