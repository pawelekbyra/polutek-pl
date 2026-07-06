import { NextRequest, NextResponse } from "next/server";
import { normalizeMuxWebhook } from "@/lib/modules/video";
import { VideoProviderWebhookService } from "@/lib/modules/video";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createScopedLogger } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";

const logger = createScopedLogger("mux-webhook");

const MUX_WEBHOOK_TOLERANCE_SECONDS = 300;

function verifyMuxWebhookSignature(body: string, signature: string | null, secret: string, now = Date.now()): boolean {
  if (!signature) return false;

  const timestampMatch = signature.match(/(?:^|,)t=(\d+)(?:,|$)/);
  const signatureMatch = signature.match(/(?:^|,)v1=([a-f0-9]+)(?:,|$)/i);
  if (!timestampMatch || !signatureMatch) return false;

  const timestampSeconds = Number(timestampMatch[1]);
  if (!Number.isSafeInteger(timestampSeconds)) return false;

  const ageSeconds = Math.abs(Math.floor(now / 1000) - timestampSeconds);
  if (ageSeconds > MUX_WEBHOOK_TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestampSeconds}.${body}`;
  const expectedSignature = createHmac("sha256", secret).update(signedPayload).digest("hex");

  try {
    const a = Buffer.from(expectedSignature, "hex");
    const b = Buffer.from(signatureMatch[1], "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (!webhookSecret) {
    logger.error("Mux webhook secret is missing");
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const signature = req.headers.get("mux-signature");
  if (!verifyMuxWebhookSignature(rawBody, signature, webhookSecret)) {
    logger.warn("Mux webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const ctx = createAppContext({ actor: { type: "system", reason: "Mux Webhook" } });
    const normalized = normalizeMuxWebhook(payload);
    const result = await new VideoProviderWebhookService().ingestProviderWebhook({ ...normalized, payload: normalized.raw }, ctx);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    logger.error("Unexpected error in Mux webhook", { error });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
