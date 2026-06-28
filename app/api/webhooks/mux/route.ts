import { NextRequest, NextResponse } from "next/server";
import { handleMuxWebhook, MuxWebhookPayload } from "@/lib/modules/video/application/handle-mux-webhook.use-case";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger("mux-webhook");

function verifyMuxWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const { createHmac } = require("crypto");
  const expectedSignature = createHmac("sha256", secret).update(body).digest("hex");
  // Mux sends "t=<ts>,v1=<sig>" — extract v1 part
  const match = signature.match(/v1=([a-f0-9]+)/);
  if (!match) return false;
  try {
    const a = Buffer.from(expectedSignature, "hex");
    const b = Buffer.from(match[1], "hex");
    if (a.length !== b.length) return false;
    const { timingSafeEqual } = require("crypto");
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (webhookSecret) {
    const signature = req.headers.get("mux-signature");
    if (!verifyMuxWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn("Mux webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: MuxWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MuxWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const HANDLED_EVENTS = new Set([
    "video.asset.ready",
    "video.asset.errored",
    "video.upload.asset_created",
  ]);

  if (!HANDLED_EVENTS.has(payload.type)) {
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  try {
    const ctx = createAppContext({ actor: { type: "system", reason: "Mux Webhook" } });
    const result = await handleMuxWebhook(payload, ctx);

    if (!result.ok) {
      logger.error("Mux webhook handling failed", { error: result.error });
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...result.data });
  } catch (error: unknown) {
    logger.error("Unexpected error in Mux webhook", { error });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
