import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { processOwnMailEvents } from "@/lib/modules/email";
import { logger } from "@/lib/logger";
import { RequestBodyTooLargeError, readRequestTextWithLimit } from "@/lib/utils/request-body";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;

/**
 * Own mail path (docs/operations/MAIL-OWN-TRANSPORT.md): the host timer posts a window of the Postfix log here.
 * Address-level hard bounces suppress the address; blocks by receivers are counted and answered with `alert: true`
 * (the timer script then fails its unit, which health.sh reports). POST, text/plain body, CRON_SECRET bearer.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedToken = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expectedToken.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let text: string;
  try {
    text = await readRequestTextWithLimit(req, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    throw error;
  }

  try {
    const ctx = createAppContext({ actor: { type: "system", reason: "own-mail-events-cron" } });
    const summary = await processOwnMailEvents(ctx, text);
    // errors > 0: a 500 makes the timer keep its position and send the same window again (events are idempotent).
    if (summary.errors > 0) return NextResponse.json({ ...summary, alert: true }, { status: 500 });
    return NextResponse.json({ ...summary, alert: summary.blocks > 0 });
  } catch (error) {
    logger.error("[cron] own-mail-events failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
