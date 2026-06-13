import { AppContext } from "../../shared/app-context";
import { ResendWebhookInput, ResendWebhookResult } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError, WebhookInvalidPayloadError } from "../domain/email.errors";
import { logger } from "@/lib/logger";
import { EmailEventLockService } from "../infrastructure/email-event-lock.service";

/**
 * handleResendWebhook use case.
 * R9 foundation: handles Resend webhook events after signature verification.
 * R10 hardened: atomic idempotency via EmailEventLockService.
 */
export async function handleResendWebhook(
  ctx: AppContext,
  input: ResendWebhookInput
): Promise<UseCaseResult<ResendWebhookResult, EmailError>> {
  // 1. Robust validation
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

  const resendEmailId = data.email_id;
  if (!resendEmailId) {
      logger.warn(`[handleResendWebhook] Event ${type} missing email_id`);
  }

  // 2. Atomic Idempotency check via Lock Service
  // eventId (from svix-id) is preferred as canonical providerEventId
  const providerEventId = eventId;
  const lockService = new EmailEventLockService({ read: ctx.db.read, write: ctx.prisma });

  if (providerEventId) {
    const lockStatus = await lockService.acquireLock({
        providerEventId,
        type,
        payload: input as any
    });

    if (lockStatus === 'ALREADY_PROCESSED') {
        return ok({
            received: true,
            accepted: true,
            duplicate: true,
            idempotency: "available"
        });
    }

    if (lockStatus === 'CONFLICT') {
        // Another process is currently handling this event
        return ok({
            received: true,
            accepted: true,
            duplicate: true,
            idempotency: "available"
        });
    }
  }

  logger.info(`[handleResendWebhook] Processing event: ${type}`, { email_id: resendEmailId, event_id: eventId });

  try {
    // 3. Normalize and handle specific events
    const supportedTypes = [
      'email.sent',
      'email.delivered',
      'email.delivery_delayed',
      'email.bounced',
      'email.complained',
      'email.opened',
      'email.clicked',
      'email.unsubscribed',
      'email.received'
    ];

    if (!supportedTypes.includes(type)) {
      logger.info(`[handleResendWebhook] Accepted but ignored unsupported event type: ${type}`);
      if (providerEventId) {
        await lockService.releaseWithSuccess(providerEventId, {
            resendEmailId,
            email: data.to?.[0]
        });
      }
      return ok({
          received: true,
          accepted: true,
          ignored: true,
          idempotency: providerEventId ? "available" : "best_effort"
      });
    }

    if (resendEmailId) {
        switch (type) {
          case 'email.sent':
            await updateRecipientStatus(ctx, resendEmailId, 'SENT', { sentAt: new Date() });
            break;
          case 'email.delivered':
            await updateRecipientStatus(ctx, resendEmailId, 'DELIVERED', { deliveredAt: new Date() });
            break;
          case 'email.delivery_delayed':
            break;
          case 'email.bounced':
            await updateRecipientStatus(ctx, resendEmailId, 'BOUNCED', { bouncedAt: new Date() }, true);
            break;
          case 'email.complained':
            await updateRecipientStatus(ctx, resendEmailId, 'COMPLAINED', { complainedAt: new Date() }, true);
            break;
          case 'email.opened':
            await updateRecipientStatus(ctx, resendEmailId, 'OPENED', { openedAt: new Date() });
            break;
          case 'email.clicked':
            await updateRecipientStatus(ctx, resendEmailId, 'CLICKED', { clickedAt: new Date() });
            break;
          case 'email.unsubscribed':
            await handleUnsubscribe(ctx, data.to?.[0]);
            break;
          case 'email.received':
            await handleInboundEmail(ctx, data);
            break;
        }
    }

    // 4. Success Release
    if (providerEventId) {
        await lockService.releaseWithSuccess(providerEventId, {
            resendEmailId,
            email: data.to?.[0]
        });
    }

    return ok({
        received: true,
        accepted: true,
        duplicate: false,
        idempotency: providerEventId ? "available" : "best_effort"
    });
  } catch (error: any) {
    logger.error("[handleResendWebhook] Error processing webhook", error);
    // 5. Failure Release
    if (providerEventId) {
        await lockService.releaseWithFailure(providerEventId, error.message || String(error));
    }
    return fail(new EmailError(error.message || "Internal error during webhook handling"));
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

async function updateRecipientStatus(ctx: AppContext, resendEmailId: string, status: string, extraData: any = {}, isError = false) {
  // Use a transaction or at least ensure atomic check-and-update if possible.
  // Given we have an outer lock on providerEventId, we are safe from same-event concurrency.
  // But we still need status priority protection.

  const recipient = await ctx.prisma.broadcastEmailRecipient.findFirst({
    where: { resendEmailId }
  });

  if (!recipient) return;

  // Terminal state protection and status hierarchy
  const currentPriority = STATUS_PRIORITY[recipient.status] || 0;
  const newPriority = STATUS_PRIORITY[status] || 0;

  // Don't downgrade status (e.g., if DELIVERED arrives after OPENED due to race condition)
  // And never overwrite terminal states (priority 100)
  if (newPriority <= currentPriority && currentPriority !== 0) {
      logger.info(`[handleResendWebhook] Skipping status update for ${resendEmailId}: ${recipient.status} -> ${status} (priority check)`);
      return;
  }

  await ctx.prisma.broadcastEmailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: status as any,
      ...extraData
    }
  });

  // Update aggregate counts in BroadcastEmail
  if (status === 'SENT' && recipient.status === 'PENDING') {
    await ctx.prisma.broadcastEmail.update({
        where: { id: recipient.broadcastEmailId },
        data: { sentCount: { increment: 1 } }
    });
  } else if (isError && currentPriority < 100) {
    await ctx.prisma.broadcastEmail.update({
        where: { id: recipient.broadcastEmailId },
        data: { errorCount: { increment: 1 } }
    });
  }
}

async function handleUnsubscribe(ctx: AppContext, email: string) {
    if (!email) return;
    const user = await ctx.prisma.user.findUnique({ where: { email } });
    await ctx.prisma.emailPreference.upsert({
        where: { email },
        create: {
            email,
            userId: user?.id,
            marketingEmails: false,
            unsubscribedAt: new Date()
        },
        update: {
            marketingEmails: false,
            unsubscribedAt: new Date()
        }
    });
}

async function handleInboundEmail(ctx: AppContext, data: any) {
    const user = await ctx.prisma.user.findUnique({ where: { email: data.from } });
    // inboundEmail has a unique constraint on resendId
    try {
        await ctx.prisma.inboundEmail.create({
            data: {
                fromEmail: data.from,
                toEmail: data.to?.[0] || 'unknown',
                subject: data.subject,
                text: data.text,
                html: data.html,
                resendId: data.email_id,
                status: 'NEW',
                userId: user?.id
            }
        });
    } catch (e: any) {
        // If it already exists, just log and continue
        logger.info(`[handleResendWebhook] Inbound email ${data.email_id} already exists`);
    }
}
