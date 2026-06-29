import { NextRequest, NextResponse } from "next/server";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { stripeReconciliation } from "@/lib/modules/payments";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ctx = createAppContext({ type: "system", reason: "stripe_reconciliation_cron" });
    const result = await stripeReconciliation(ctx);

    if (!result.ok) {
      logger.error("[CronStripeReconciliation] Failed:", result.error.message);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    logger.info("[CronStripeReconciliation] Complete", result.data);
    return NextResponse.json({ ok: true, ...result.data });
  } catch (err: any) {
    logger.error("[CronStripeReconciliation] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
