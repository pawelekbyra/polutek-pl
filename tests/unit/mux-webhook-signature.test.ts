import { describe, expect, it } from "vitest";
import {
  createMuxWebhookSignature,
  verifyMuxWebhookSignature,
} from "@/lib/security/mux-webhook-signature";

const BODY = JSON.stringify({ type: "video.asset.ready", data: { id: "asset_123", status: "ready" } });
const SECRET = "mux-webhook-secret";
const NOW = 1_800_000_000_000;
const NOW_SECONDS = Math.floor(NOW / 1000);

describe("Mux webhook signature verification", () => {
  it("accepts a valid Mux-style signature", () => {
    const signature = createMuxWebhookSignature(BODY, SECRET, NOW_SECONDS);

    const result = verifyMuxWebhookSignature(BODY, signature, SECRET, NOW);

    expect(result).toMatchObject({ ok: true, timestampSeconds: NOW_SECONDS, ageSeconds: 0 });
  });

  it("rejects a missing signature", () => {
    const result = verifyMuxWebhookSignature(BODY, null, SECRET, NOW);

    expect(result).toEqual({ ok: false, reason: "MISSING_SIGNATURE" });
  });

  it("rejects a malformed signature", () => {
    const result = verifyMuxWebhookSignature(BODY, "not-a-mux-signature", SECRET, NOW);

    expect(result).toEqual({ ok: false, reason: "MALFORMED_SIGNATURE" });
  });

  it("rejects stale signatures outside the tolerance window", () => {
    const staleTimestamp = NOW_SECONDS - 301;
    const signature = createMuxWebhookSignature(BODY, SECRET, staleTimestamp);

    const result = verifyMuxWebhookSignature(BODY, signature, SECRET, NOW);

    expect(result).toMatchObject({
      ok: false,
      reason: "TIMESTAMP_OUTSIDE_TOLERANCE",
      timestampSeconds: staleTimestamp,
      ageSeconds: 301,
    });
  });

  it("rejects signatures created for a different payload", () => {
    const signature = createMuxWebhookSignature(BODY, SECRET, NOW_SECONDS);

    const result = verifyMuxWebhookSignature(`${BODY} `, signature, SECRET, NOW);

    expect(result).toMatchObject({ ok: false, reason: "SIGNATURE_MISMATCH" });
  });

  it("rejects signatures created with a different secret", () => {
    const signature = createMuxWebhookSignature(BODY, "different-secret", NOW_SECONDS);

    const result = verifyMuxWebhookSignature(BODY, signature, SECRET, NOW);

    expect(result).toMatchObject({ ok: false, reason: "SIGNATURE_MISMATCH" });
  });
});
