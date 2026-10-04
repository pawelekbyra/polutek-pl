import { Resend } from "resend";

/**
 * Verifies a Resend webhook (Svix / Standard Webhooks signature) through the Resend SDK.
 * The signature covers `<svix-id>.<svix-timestamp>.<raw body>`, so the body must be the exact bytes
 * received, and the secret must be the signing secret of THIS endpoint in the Resend dashboard
 * (each endpoint has its own `whsec_…`). Timestamps more than 5 minutes off are refused.
 *
 * On failure it says why, without ever exposing the secret: the shape of the configured secret, the
 * library's message ("No matching signature found" = wrong secret or changed body; "Message
 * timestamp too old/new" = clock skew or a very late retry) and the clock difference.
 */

export type ResendWebhookFailureReason = "secret_invalid" | "signature_mismatch" | "timestamp_out_of_range" | "headers_invalid";

export type ResendWebhookVerification =
  | { ok: true; payload: unknown }
  | {
      ok: false;
      reason: ResendWebhookFailureReason;
      /** Safe to log: no secret, no body. */
      diagnostics: {
        message: string;
        svixId: string;
        clockSkewSeconds: number | null;
        secretLength: number;
        secretHasPrefix: boolean;
      };
    };

const SECRET_SHAPE = /^whsec_[A-Za-z0-9+/]+={0,2}$/;

/**
 * Environment files edited on Windows or pasted with quotes leave `\r`, spaces or quotes around the
 * value, which silently changes the key. Strip that; anything else stays as it is.
 */
export function normalizeWebhookSecret(raw: string | undefined | null): string {
  return (raw ?? "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();
}

export function verifyResendWebhook(input: {
  rawBody: string;
  headers: { id: string; timestamp: string; signature: string };
  secret: string;
  nowSeconds?: number;
}): ResendWebhookVerification {
  const secret = normalizeWebhookSecret(input.secret);
  const timestampSeconds = Number(input.headers.timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const diagnostics = (message: string) => ({
    message,
    svixId: input.headers.id.slice(0, 64),
    clockSkewSeconds: Number.isFinite(timestampSeconds) ? nowSeconds - timestampSeconds : null,
    secretLength: secret.length,
    secretHasPrefix: secret.startsWith("whsec_"),
  });

  if (!SECRET_SHAPE.test(secret)) {
    return { ok: false, reason: "secret_invalid", diagnostics: diagnostics("RESEND_WEBHOOK_SECRET is not a whsec_… value") };
  }

  try {
    // The SDK client is only used for verification here; the API key is not needed for it.
    const resend = new Resend(process.env.RESEND_API_KEY || "re_webhook_verification_only");
    const payload = resend.webhooks.verify({ payload: input.rawBody, headers: input.headers, webhookSecret: secret });
    return { ok: true, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason: ResendWebhookFailureReason = /timestamp/i.test(message)
      ? "timestamp_out_of_range"
      : /headers/i.test(message)
        ? "headers_invalid"
        : "signature_mismatch";
    return { ok: false, reason, diagnostics: diagnostics(message.slice(0, 200)) };
  }
}
