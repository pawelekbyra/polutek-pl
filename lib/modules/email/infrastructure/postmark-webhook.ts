/**
 * Postmark webhook events turned into the shape handleResendWebhook() already processes, so bounces and spam
 * complaints from either provider go through one code path (recipient status, suppression, idempotency lock).
 * Postmark does not sign webhooks: the route authenticates with HTTP Basic credentials set on the webhook URL.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { ResendWebhookInput } from "../domain/email.dto";

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

function tagsOf(body: Json): Record<string, string> {
  const meta = body.Metadata;
  const out: Record<string, string> = {};
  if (meta && typeof meta === "object") for (const [k, v] of Object.entries(meta as Json)) if (typeof v === "string") out[k] = v;
  return out;
}

/** null = an event this app does not act on (opens, clicks, subscription changes, unknown). */
export function normalizePostmarkEvent(raw: unknown): ResendWebhookInput | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Json;
  const recordType = str(body.RecordType);
  const messageId = str(body.MessageID);
  if (!recordType || !messageId) return null;
  const tags = tagsOf(body);
  const at = str(body.DeliveredAt) ?? str(body.BouncedAt) ?? str(body.ReceivedAt);
  const base = (type: string, to: string | undefined, extra: Json = {}): ResendWebhookInput => ({
    // Postmark has no event id: this one is stable per event, so a retried delivery hits the idempotency lock.
    eventId: `postmark:${recordType}:${messageId}:${String(body.ID ?? "")}`,
    type,
    created_at: at,
    data: { email_id: messageId, to: to ? [to] : undefined, tags, ...extra },
  });
  switch (recordType) {
    case "Delivery":
      return base("email.delivered", str(body.Recipient));
    case "Bounce": {
      // Only a bounce Postmark itself deactivated is permanent; anything else must never suppress an address.
      const permanent = body.Inactive === true;
      return base("email.bounced", str(body.Email), { bounce: { type: permanent ? "permanent" : "transient", subType: str(body.Type), message: str(body.Description) } });
    }
    case "SpamComplaint":
      return base("email.complained", str(body.Email));
    default:
      return null;
  }
}

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Constant-time check of an `Authorization: Basic ...` header against the configured user and password. */
export function checkBasicAuth(header: string | null, user: string, password: string): boolean {
  if (!header || !header.toLowerCase().startsWith("basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const okUser = timingSafeEqual(digest(decoded.slice(0, i)), digest(user));
  const okPass = timingSafeEqual(digest(decoded.slice(i + 1)), digest(password));
  return okUser && okPass;
}
