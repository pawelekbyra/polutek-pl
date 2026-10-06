import type { BroadcastRecipientStatus, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { unsubscribeUserFromContentNotifications } from "@/lib/modules/subscriptions";
import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError, WebhookInvalidPayloadError } from "../domain/email.errors";
import { EmailEventLockService } from "../infrastructure/email-event-lock.service";
import { APP_EMAIL_TAG } from "../infrastructure/email.transport";

/**
 * Amazon SES delivery events that arrive through SNS (already signature-verified by the route).
 * Two payload shapes are understood:
 *  - event publishing (configuration set -> SNS): `eventType` Bounce | Complaint | Delivery | Reject | DeliveryDelay | Send
 *    (Open, Click and the rest are ignored: tracking is off),
 *  - identity notifications: `notificationType` Bounce | Complaint | Delivery.
 * Effects: permanent bounce and complaint suppress the address (EmailSuppression); a complaint also withdraws
 * content-notification consent; broadcast recipients are moved forward, never backward. Idempotent per SNS
 * MessageId (EmailEvent.providerEventId). Any database error is returned as 5xx so SNS retries.
 */

export type SesEventResult = { received: true; accepted: boolean; ignored?: boolean; duplicate?: boolean };

type Kind = "send" | "delivery" | "bounce" | "bounce_transient" | "complaint" | "reject" | "delay";

export type NormalizedSesEvent = {
  kind: Kind;
  /** Stored in EmailEvent.type (same vocabulary the admin screens count). */
  eventType: string;
  sesMessageId: string;
  recipients: string[];
};

const EVENT_TYPE: Record<Kind, string> = {
  send: "email.sent",
  delivery: "email.delivered",
  bounce: "email.bounced",
  bounce_transient: "email.bounced_transient",
  complaint: "email.complained",
  reject: "email.failed",
  delay: "email.delivery_delayed",
};

type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const addresses = (list: unknown, key: string): string[] =>
  Array.isArray(list) ? list.flatMap((item) => { const a = asObject(item)?.[key]; return typeof a === "string" ? [a] : []; }) : [];

/** Returns null for events we do not act on (Open, Click, Rendering Failure, other senders' mail, unknown shapes). */
export function normalizeSesEvent(payload: unknown): NormalizedSesEvent | null {
  const body = asObject(payload);
  const mail = asObject(body?.mail);
  if (!body || !mail || typeof mail.messageId !== "string") return null;

  // Event publishing carries our tags; mail of another sender in the same account is not ours.
  const tags = asObject(mail.tags);
  const appTag = tags?.[APP_EMAIL_TAG.name];
  if (appTag !== undefined) {
    const values = Array.isArray(appTag) ? appTag : [appTag];
    if (!values.includes(APP_EMAIL_TAG.value)) return null;
  }

  const name = String(body.eventType ?? body.notificationType ?? "");
  const destination = Array.isArray(mail.destination) ? mail.destination.filter((d): d is string => typeof d === "string") : [];
  const base = { sesMessageId: mail.messageId };

  switch (name) {
    case "Bounce": {
      const bounce = asObject(body.bounce);
      const permanent = bounce?.bounceType === "Permanent";
      const recipients = addresses(bounce?.bouncedRecipients, "emailAddress");
      const kind: Kind = permanent ? "bounce" : "bounce_transient";
      return { ...base, kind, eventType: EVENT_TYPE[kind], recipients: recipients.length ? recipients : destination };
    }
    case "Complaint": {
      const recipients = addresses(asObject(body.complaint)?.complainedRecipients, "emailAddress");
      return { ...base, kind: "complaint", eventType: EVENT_TYPE.complaint, recipients: recipients.length ? recipients : destination };
    }
    case "Delivery": {
      const list = asObject(body.delivery)?.recipients;
      const recipients = Array.isArray(list) ? list.filter((r): r is string => typeof r === "string") : [];
      return { ...base, kind: "delivery", eventType: EVENT_TYPE.delivery, recipients: recipients.length ? recipients : destination };
    }
    case "Reject":
      return { ...base, kind: "reject", eventType: EVENT_TYPE.reject, recipients: destination };
    case "DeliveryDelay":
      return { ...base, kind: "delay", eventType: EVENT_TYPE.delay, recipients: addresses(asObject(body.deliveryDelay)?.delayedRecipients, "emailAddress") };
    case "Send":
      return { ...base, kind: "send", eventType: EVENT_TYPE.send, recipients: destination };
    default:
      return null;
  }
}

const STATUS_PRIORITY: Record<string, number> = {
  PENDING: 0, SKIPPED: 1, SENT: 2, DELIVERED: 3, OPENED: 4, CLICKED: 5,
  BOUNCED: 100, COMPLAINED: 100, FAILED: 100, UNSUBSCRIBED: 100,
};

/** Moves a broadcast recipient forward (never backward, never out of a terminal state); mail without a recipient row is a no-op. */
async function updateRecipientStatus(
  ctx: AppContext,
  sesMessageId: string,
  status: BroadcastRecipientStatus,
  extra: Omit<Prisma.BroadcastEmailRecipientUpdateManyMutationInput, "status"> = {},
) {
  const newPriority = STATUS_PRIORITY[status] ?? 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const recipient = await ctx.prisma.broadcastEmailRecipient.findFirst({ where: { resendEmailId: sesMessageId }, select: { id: true, status: true } });
    if (!recipient) return;
    const current = STATUS_PRIORITY[recipient.status] ?? 0;
    if (newPriority <= current && current !== 0) return;
    const { count } = await ctx.prisma.broadcastEmailRecipient.updateMany({ where: { id: recipient.id, status: recipient.status }, data: { status, ...extra } });
    if (count > 0) return;
  }
  throw new EmailError("Failed to update recipient status after 3 attempts (concurrency)", 503, "CONCURRENCY_ERROR");
}

async function suppress(ctx: AppContext, reason: "BOUNCE" | "COMPLAINT", emails: string[], sesMessageId: string) {
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    await ctx.prisma.emailSuppression.upsert({
      where: { email },
      create: { email, reason, active: true, providerEmailId: sesMessageId, source: "SES_SNS" },
      update: { reason, active: true, providerEmailId: sesMessageId },
    });
  }
  logger.info(`[ses-events] Suppression recorded (reason: ${reason}, addresses: ${emails.length})`);
}

/** Complaint = the person does not want this mail: same effect as the unsubscribe link, by address. */
async function withdrawConsent(ctx: AppContext, emails: string[]) {
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    const user = await ctx.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await unsubscribeUserFromContentNotifications(ctx, user.id);
    // An address that answered the consent question without an account (or whose row is not linked yet).
    await ctx.prisma.emailPreference.updateMany({ where: { email, marketingEmails: true }, data: { marketingEmails: false, unsubscribedAt: new Date() } });
  }
}

export async function handleSesEvent(
  ctx: AppContext,
  input: { snsMessageId: string; payload: unknown },
): Promise<UseCaseResult<SesEventResult, EmailError>> {
  if (!input.snsMessageId) return fail(new WebhookInvalidPayloadError("snsMessageId is required for idempotency"));

  const event = normalizeSesEvent(input.payload);
  if (!event) {
    logger.info("[ses-events] Ignored event (not handled or not sent by this app)");
    return ok({ received: true, accepted: true, ignored: true });
  }

  const lock = new EmailEventLockService({ read: ctx.db.read, write: ctx.prisma });
  // Privacy: identifiers only, never addresses or content.
  const lockStatus = await lock.acquireLock({
    providerEventId: input.snsMessageId,
    type: event.eventType,
    payload: { type: event.eventType, sesMessageId: event.sesMessageId },
  });
  if (lockStatus === "ALREADY_PROCESSED") return ok({ received: true, accepted: true, duplicate: true });
  if (lockStatus === "CONFLICT") return fail(new EmailError("Event lock conflict, retry later", 503, "LOCK_CONFLICT"));

  try {
    const now = new Date();
    switch (event.kind) {
      case "send":
        await updateRecipientStatus(ctx, event.sesMessageId, "SENT", { sentAt: now });
        break;
      case "delivery":
        await updateRecipientStatus(ctx, event.sesMessageId, "DELIVERED", { deliveredAt: now });
        break;
      case "bounce":
        await updateRecipientStatus(ctx, event.sesMessageId, "BOUNCED", { bouncedAt: now });
        await suppress(ctx, "BOUNCE", event.recipients, event.sesMessageId);
        break;
      case "complaint":
        await updateRecipientStatus(ctx, event.sesMessageId, "COMPLAINED", { complainedAt: now });
        await suppress(ctx, "COMPLAINT", event.recipients, event.sesMessageId);
        await withdrawConsent(ctx, event.recipients);
        break;
      case "reject":
        await updateRecipientStatus(ctx, event.sesMessageId, "FAILED", { error: "SES_REJECTED" });
        break;
      case "bounce_transient":
      case "delay":
        break; // recorded only
    }
    try {
      await lock.releaseWithSuccess(input.snsMessageId, { resendEmailId: event.sesMessageId });
    } catch (releaseError) {
      logger.error(`[ses-events] Could not release lock with success for ${input.snsMessageId}`, releaseError);
      return fail(new EmailError("Failed to finalize event processing (lock release failure)", 503));
    }
    return ok({ received: true, accepted: true, duplicate: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[ses-events] Error processing event", error);
    try {
      await lock.releaseWithFailure(input.snsMessageId, message);
    } catch (releaseError) {
      logger.error(`[ses-events] Could not release lock with failure for ${input.snsMessageId}`, { originalError: message, releaseError });
    }
    return fail(error instanceof EmailError ? error : new EmailError(message || "Internal error during event handling", 500));
  }
}
