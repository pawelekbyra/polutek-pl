import type { BroadcastRecipientStatus, Prisma } from "@prisma/client";
import { AppContext } from "../../shared/app-context";
import { ResendWebhookInput, ResendWebhookResult } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError, WebhookInvalidPayloadError } from "../domain/email.errors";
import { logger } from "@/lib/logger";
import { EmailEventLockService } from "../infrastructure/email-event-lock.service";
import { APP_EMAIL_TAG } from "../infrastructure/email.transport";

/**
 * Delivery events we act on. Opens and clicks are not tracked (tracking is off in Resend), and
 * incoming mail goes to PP Support, not here (MX is Cloudflare Email Routing since 2026-10-02).
 * See https://resend.com/docs/dashboard/webhooks/event-types.
 */
export const HANDLED_RESEND_EVENTS = [
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.failed',
  'email.suppressed',
] as const;

/**
 * The Resend account (and so its webhooks) is shared with PP Support. Only mail this app sent carries
 * the `app=pawelperfect` tag; anything else is acknowledged and ignored, so a bounce on a support
 * reply can never block a user here.
 */
function isOurEmail(input: ResendWebhookInput): boolean {
  return input.data?.tags?.[APP_EMAIL_TAG.name] === APP_EMAIL_TAG.value;
}

/**
 * handleResendWebhook: runs after the signature check in the route. Idempotent per svix-id
 * (EmailEventLockService); a failed run is retried by Resend.
 */
export async function handleResendWebhook(
  ctx: AppContext,
  input: ResendWebhookInput
): Promise<UseCaseResult<ResendWebhookResult, EmailError>> {
  if (!input || typeof input !== 'object') {
    return fail(new WebhookInvalidPayloadError("Input must be an object"));
  }

  const { type, data, eventId } = input;

  if (!type || typeof type !== 'string') {
    return fail(new WebhookInvalidPayloadError("Event type is required and must be a string"));
  }

  if (!data || typeof data !== 'object') {
    return fail(new WebhookInvalidPayloadError("Event data is required and must be an object"));
  }

  if (!eventId) {
    logger.error(`[handleResendWebhook] Webhook rejected: missing eventId (svix-id) for type=${type}`);
    return fail(new WebhookInvalidPayloadError("eventId (svix-id) is required for idempotency"));
  }

  const handled = (HANDLED_RESEND_EVENTS as readonly string[]).includes(type);
  if (!handled || !isOurEmail(input)) {
    logger.info(`[handleResendWebhook] Ignored ${type} (${handled ? 'not sent by this app' : 'event not handled'})`);
    return ok({ received: true, accepted: true, ignored: true, idempotency: "available" });
  }

  const resendEmailId = typeof data.email_id === 'string' ? data.email_id : undefined;
  if (!resendEmailId) {
    return fail(new WebhookInvalidPayloadError("email_id is required"));
  }

  const lockService = new EmailEventLockService({ read: ctx.db.read, write: ctx.prisma });

  // Privacy: store only identifiers, never addresses or content.
  const lockStatus = await lockService.acquireLock({
    providerEventId: eventId,
    type,
    payload: { type, created_at: input.created_at, email_id: resendEmailId },
  });

  if (lockStatus === 'ALREADY_PROCESSED') {
    return ok({ received: true, accepted: true, duplicate: true, idempotency: "available" });
  }

  if (lockStatus === 'CONFLICT') {
    // 503 makes Resend retry later.
    return fail(new EmailError("Event lock conflict - another process is handling this event. Please retry.", 503, 'LOCK_CONFLICT'));
  }

  try {
    switch (type) {
      case 'email.sent':
        await updateRecipientStatus(ctx, resendEmailId, 'SENT', { sentAt: new Date() });
        break;
      case 'email.delivered':
        await updateRecipientStatus(ctx, resendEmailId, 'DELIVERED', { deliveredAt: new Date() });
        break;
      case 'email.delivery_delayed':
        break;
      case 'email.bounced': {
        // `email.bounced` is a permanent rejection; a transient one (if ever flagged) blocks nothing.
        const transient = typeof data.bounce?.type === 'string' && data.bounce.type.toLowerCase() === 'transient';
        await updateRecipientStatus(ctx, resendEmailId, 'BOUNCED', { bouncedAt: new Date() });
        if (!transient) await handleSuppression(ctx, 'BOUNCE', data.to?.[0], resendEmailId);
        break;
      }
      case 'email.complained':
        await updateRecipientStatus(ctx, resendEmailId, 'COMPLAINED', { complainedAt: new Date() });
        await handleSuppression(ctx, 'COMPLAINT', data.to?.[0], resendEmailId);
        break;
      case 'email.failed':
        await updateRecipientStatus(ctx, resendEmailId, 'FAILED', { error: 'PROVIDER_FAILED' });
        break;
      case 'email.suppressed':
        // Resend did not send: the address is on its suppression list (earlier bounce/complaint).
        await updateRecipientStatus(ctx, resendEmailId, 'FAILED', { error: 'SUPPRESSED_BY_PROVIDER' });
        break;
    }

    try {
      await lockService.releaseWithSuccess(eventId, { resendEmailId });
    } catch (releaseError) {
      logger.error(`[handleResendWebhook] Could not release lock with success for ${eventId}`, releaseError);
      return fail(new EmailError("Failed to finalize event processing (lock release failure)", 503));
    }

    return ok({ received: true, accepted: true, duplicate: false, idempotency: "available" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[handleResendWebhook] Error processing webhook", error);

    try {
      await lockService.releaseWithFailure(eventId, message);
    } catch (releaseError) {
      logger.error(`[handleResendWebhook] Could not release lock with failure for ${eventId}`, {
        originalError: message,
        releaseError,
      });
    }

    if (error instanceof EmailError) {
      return fail(error);
    }

    return fail(new EmailError(message || "Internal error during webhook handling", 500));
  }
}

const STATUS_PRIORITY: Record<string, number> = {
  'PENDING': 0,
  'SKIPPED': 1,
  'SENT': 2,
  'DELIVERED': 3,
  'OPENED': 4,
  'CLICKED': 5,
  'BOUNCED': 100, // Terminal
  'COMPLAINED': 100, // Terminal
  'FAILED': 100, // Terminal
  'UNSUBSCRIBED': 100, // Terminal
};

/**
 * Moves a broadcast recipient forward (never backward, never out of a terminal state). Mail that is
 * not a broadcast (system mails) has no recipient row: nothing to update. Counts shown to the admin
 * are computed from these statuses, so no counters are touched here.
 */
async function updateRecipientStatus(
  ctx: AppContext,
  resendEmailId: string,
  status: BroadcastRecipientStatus,
  extraData: Omit<Prisma.BroadcastEmailRecipientUpdateManyMutationInput, "status"> = {},
) {
  const newPriority = STATUS_PRIORITY[status] || 0;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const recipient = await ctx.prisma.broadcastEmailRecipient.findFirst({
      where: { resendEmailId },
      select: { id: true, status: true },
    });
    if (!recipient) return;

    const currentPriority = STATUS_PRIORITY[recipient.status] || 0;
    if (newPriority <= currentPriority && currentPriority !== 0) return;

    // Compare-and-set on the status read above.
    const { count } = await ctx.prisma.broadcastEmailRecipient.updateMany({
      where: { id: recipient.id, status: recipient.status },
      data: { status, ...extraData },
    });
    if (count > 0) return;
    logger.warn(`[handleResendWebhook] Retrying status update for ${resendEmailId} (attempt ${attempt})`);
  }

  throw new EmailError(`Failed to update recipient status after ${maxAttempts} attempts due to concurrency conflicts`, 503, 'CONCURRENCY_ERROR');
}

async function handleSuppression(ctx: AppContext, reason: 'BOUNCE' | 'COMPLAINT', emailFromPayload: string | undefined, resendEmailId: string) {
  // The recipient row is the most reliable address; system mails fall back to the event's `to`.
  let email = emailFromPayload;
  const recipient = await ctx.prisma.broadcastEmailRecipient.findFirst({
    where: { resendEmailId },
    select: { email: true },
  });
  if (recipient) email = recipient.email;

  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    // Fail so the event is retried rather than silently dropping a bounce.
    throw new EmailError(`Failed to determine email for ${reason} suppression.`, 400, 'MISSING_EMAIL');
  }

  await ctx.prisma.emailSuppression.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      reason,
      active: true,
      providerEmailId: resendEmailId,
      source: 'RESEND_WEBHOOK',
    },
    update: {
      reason,
      active: true,
      providerEmailId: resendEmailId,
    },
  });
  logger.info(`[handleResendWebhook] Suppression recorded (reason: ${reason})`);
}
