import { NextRequest, NextResponse } from "next/server";
import { handleMuxWebhook } from "@/lib/modules/video";
import type { MuxWebhookPayload } from "@/lib/modules/video";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createScopedLogger } from "@/lib/logger";
import { verifyMuxWebhookSignature } from "@/lib/security/mux-webhook-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = createScopedLogger("mux-webhook");

const HANDLED_EVENTS = new Set([
  "video.asset.ready",
  "video.asset.errored",
  "video.upload.asset_created",
]);

function getMuxPayloadSummary(payload: MuxWebhookPayload) {
  return {
    eventType: payload.type,
    muxAssetId: payload.data?.id || null,
    muxUploadIdPresent: Boolean(payload.data?.upload_id),
    muxStatus: payload.data?.status || null,
  };
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (!webhookSecret) {
    logger.error("Mux webhook secret is missing");
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const signature = req.headers.get("mux-signature");
  const verification = verifyMuxWebhookSignature(rawBody, signature, webhookSecret);
  if (!verification.ok) {
    logger.warn("Mux webhook signature verification failed", {
      reason: verification.reason,
      ageSeconds: verification.ageSeconds ?? null,
      timestampPresent: verification.timestampSeconds !== undefined,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MuxWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MuxWebhookPayload;
  } catch {
    logger.warn("Mux webhook payload is not valid JSON", { bodyLength: rawBody.length });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payloadSummary = getMuxPayloadSummary(payload);

  if (!HANDLED_EVENTS.has(payload.type)) {
    logger.info("Mux webhook event ignored", payloadSummary);
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  logger.info("Mux webhook accepted", {
    ...payloadSummary,
    ageSeconds: verification.ageSeconds,
  });

  try {
    const ctx = createAppContext({ actor: { type: "system", reason: "Mux Webhook" } });
    const result = await handleMuxWebhook(payload, ctx);

    if (!result.ok) {
      logger.error("Mux webhook handling failed", { error: result.error, ...payloadSummary });
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...result.data });
  } catch (error: unknown) {
    logger.error("Unexpected error in Mux webhook", { error, ...payloadSummary });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
