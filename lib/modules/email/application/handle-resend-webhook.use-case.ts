import { AppContext } from "../../shared/app-context";
import { ResendWebhookInput, ResendWebhookResult } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError, WebhookInvalidPayloadError } from "../domain/email.errors";
import { logger } from "@/lib/logger";
import { EmailEventLockService } from "../infrastructure/email-event-lock.service";
import { isPrismaErrorCode } from "@/lib/utils/db";

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

  // 2. Atomic Idempotency check via Lock Service
  // eventId (from svix-id) is REQUIRED for all events to ensure strict idempotency.
  const providerEventId = eventId;

  if (!providerEventId) {
      logger.error(`[handleResendWebhook] Webhook rejected: missing eventId (svix-id) for type=${type}`);
      return fail(new WebhookInvalidPayloadError("eventId (svix-id) is required for idempotency"));
  }

  const resendEmailId = data.email_id;
  if (!resendEmailId) {
      logger.warn(`[handleResendWebhook] Event ${type} missing email_id`);
  }

  const lockService = new EmailEventLockService({ read: ctx.db.read, write: ctx.prisma });

  // Privacy: minimize stored payload to essential identifiers only
  const minimalPayload = {
      type,
      created_at: (input as any).created_at,
      email_id: resendEmailId,
  };

  const lockStatus = await lockService.acquireLock({
      providerEventId,
      type,
      payload: minimalPayload
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
      // 503 Service Unavailable triggers a retry by most webhook providers
      return fail(new EmailError("Event lock conflict - another process is handling this event. Please retry.", 503, 'LOCK_CONFLICT'));
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
      try {
        await lockService.releaseWithSuccess(providerEventId, { resendEmailId });
      } catch (releaseError) {
        logger.error(`[handleResendWebhook] Failed to release lock with success for ignored event ${providerEventId}`, releaseError);
        return fail(new EmailError("Failed to finalize event processing (lock release failure)", 503));
      }
      return ok({
          received: true,
          accepted: true,
          ignored: true,
          idempotency: "available"
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
    try {
        await lockService.releaseWithSuccess(providerEventId, { resendEmailId });
    } catch (releaseError) {
        logger.error(`[handleResendWebhook] Critical failure: could not release lock with success for ${providerEventId}`, releaseError);
        return fail(new EmailError("Failed to finalize event processing (lock release failure)", 503));
    }

    return ok({
        received: true,
        accepted: true,
        duplicate: false,
        idempotency: "available"
    });
  } catch (error: any) {
    logger.error("[handleResendWebhook] Error processing webhook", error);
    // 5. Failure Release
    try {
        await lockService.releaseWithFailure(providerEventId, error.message || String(error));
    } catch (releaseError) {
        logger.error(`[handleResendWebhook] Secondary failure: could not release lock with failure for ${providerEventId}`, {
            originalError: error.message,
            releaseError
        });
        // Audit 6: preserve original error as returned failure
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
  const newPriority = STATUS_PRIORITY[status] || 0;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;

    // Transactional consistency for status check, update, and counter increment.
    // outer providerEventId lock handles same-event concurrency;
    // db.writeTransaction handles cross-event concurrency on the same recipient/aggregate.
    const result = await ctx.db.writeTransaction(async (tx) => {
      // 1. Fetch current state
      const recipient = await tx.broadcastEmailRecipient.findFirst({
          where: { resendEmailId }
      });

      if (!recipient) return 'NOT_FOUND';

      const currentPriority = STATUS_PRIORITY[recipient.status] || 0;

      // 2. Priority check: don't downgrade or overwrite terminal states
      if (newPriority <= currentPriority && currentPriority !== 0) {
          logger.info(`[handleResendWebhook] Skipping stale or lower-priority event for recipient ${recipient.id}: ${recipient.status} -> ${status}`);
          return 'NO_CHANGE';
      }

      // 3. Atomic transition using updateMany with status check (CAS)
      const { count } = await tx.broadcastEmailRecipient.updateMany({
          where: {
              id: recipient.id,
              status: recipient.status as any
          },
          data: {
              status: status as any,
              ...extraData
          }
      });

      if (count === 0) {
          // Conflict: someone else updated the status between findFirst and updateMany
          return 'RETRY';
      }

      // 4. Update aggregate counts in BroadcastEmail
      if (status === 'SENT' && recipient.status === 'PENDING') {
          await tx.broadcastEmail.update({
              where: { id: recipient.broadcastEmailId },
              data: { sentCount: { increment: 1 } }
          });
      } else if (isError && currentPriority < 100) {
          await tx.broadcastEmail.update({
              where: { id: recipient.broadcastEmailId },
              data: { errorCount: { increment: 1 } }
          });
      }

      return 'UPDATED';
    });

    if (result !== 'RETRY') {
        return;
    }

    if (attempts < maxAttempts) {
        logger.warn(`[handleResendWebhook] Retrying status update for ${resendEmailId} due to concurrency conflict (attempt ${attempts})`);
        // Small backoff could be added here if needed, but for webhooks simple retry is usually enough
    }
  }

  throw new EmailError(`Failed to update recipient status after ${maxAttempts} attempts due to concurrency conflicts`, 503, 'CONCURRENCY_ERROR');
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
    } catch (e: unknown) {
        // If it already exists, just log and continue
        if (isPrismaErrorCode(e, 'P2002')) {
            logger.info(`[handleResendWebhook] Inbound email ${data.email_id} already exists (duplicate)`);
            return;
        }
        // Rethrow other errors to fail the webhook processing and allow retry
        throw e;
    }
}
