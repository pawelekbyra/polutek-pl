import { createHmac, timingSafeEqual } from "crypto";

export const MUX_WEBHOOK_TOLERANCE_SECONDS = 300;

export type MuxWebhookSignatureFailureReason =
  | "MISSING_SIGNATURE"
  | "MALFORMED_SIGNATURE"
  | "INVALID_TIMESTAMP"
  | "TIMESTAMP_OUTSIDE_TOLERANCE"
  | "SIGNATURE_LENGTH_MISMATCH"
  | "SIGNATURE_MISMATCH";

export type MuxWebhookSignatureVerification =
  | {
      ok: true;
      timestampSeconds: number;
      ageSeconds: number;
    }
  | {
      ok: false;
      reason: MuxWebhookSignatureFailureReason;
      timestampSeconds?: number;
      ageSeconds?: number;
    };

function getSignedPayload(body: string, timestampSeconds: number) {
  return `${timestampSeconds}.${body}`;
}

function createMuxSignatureDigest(body: string, secret: string, timestampSeconds: number) {
  return createHmac("sha256", secret).update(getSignedPayload(body, timestampSeconds)).digest("hex");
}

export function createMuxWebhookSignature(body: string, secret: string, timestampSeconds: number) {
  const digest = createMuxSignatureDigest(body, secret, timestampSeconds);
  return `t=${timestampSeconds},v1=${digest}`;
}

export function verifyMuxWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
  now = Date.now(),
  toleranceSeconds = MUX_WEBHOOK_TOLERANCE_SECONDS,
): MuxWebhookSignatureVerification {
  if (!signature) return { ok: false, reason: "MISSING_SIGNATURE" };

  const timestampMatch = signature.match(/(?:^|,)t=(\d+)(?:,|$)/);
  const signatureMatch = signature.match(/(?:^|,)v1=([a-f0-9]+)(?:,|$)/i);
  if (!timestampMatch || !signatureMatch) return { ok: false, reason: "MALFORMED_SIGNATURE" };

  const timestampSeconds = Number(timestampMatch[1]);
  if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) {
    return { ok: false, reason: "INVALID_TIMESTAMP" };
  }

  const ageSeconds = Math.abs(Math.floor(now / 1000) - timestampSeconds);
  if (ageSeconds > toleranceSeconds) {
    return { ok: false, reason: "TIMESTAMP_OUTSIDE_TOLERANCE", timestampSeconds, ageSeconds };
  }

  const expectedSignature = createMuxSignatureDigest(body, secret, timestampSeconds);

  try {
    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(signatureMatch[1], "hex");
    if (expected.length !== received.length) {
      return { ok: false, reason: "SIGNATURE_LENGTH_MISMATCH", timestampSeconds, ageSeconds };
    }

    if (!timingSafeEqual(expected, received)) {
      return { ok: false, reason: "SIGNATURE_MISMATCH", timestampSeconds, ageSeconds };
    }

    return { ok: true, timestampSeconds, ageSeconds };
  } catch {
    return { ok: false, reason: "MALFORMED_SIGNATURE", timestampSeconds, ageSeconds };
  }
}
