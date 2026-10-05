import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { anonymizeOldTechnicalData } from "@/lib/modules/privacy";
import { processContactRemovals } from "@/lib/modules/subscriptions";
import { processStripeCustomerAnonymizations } from "@/lib/modules/payments";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Daily retention: clears IP addresses and browser data older than TECHNICAL_DATA_RETENTION_DAYS
 * retries Resend Audience contact removals and Stripe Customer anonymizations left over from account deletions.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = createAppContext({ actor: { type: "system", reason: "retention-cron" } });
  const technical = await anonymizeOldTechnicalData(ctx);
  if (!technical.ok) {
    logger.error("[cron] retention failed", technical.error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  try {
    const contactRemovals = await processContactRemovals(ctx);
    // Independent of the Resend queue: a Stripe outage must not fail the whole retention run.
    let stripeCustomers: unknown = null;
    try {
      stripeCustomers = await processStripeCustomerAnonymizations(ctx);
    } catch (error) {
      logger.error("[cron] retention: stripe customer anonymization failed", error instanceof Error ? error.message : String(error));
      stripeCustomers = { error: true };
    }
    return NextResponse.json({ technical: technical.data, contactRemovals, stripeCustomers });
  } catch (error) {
    logger.error("[cron] retention: contact removals failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
