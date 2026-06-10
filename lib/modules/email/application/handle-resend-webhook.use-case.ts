import { AppContext } from "../../shared/app-context";
import { ResendWebhookInput, ResendWebhookResult } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError, WebhookInvalidPayloadError } from "../domain/email.errors";
import { logger } from "@/lib/logger";

/**
 * handleResendWebhook use case.
 * R9 foundation: handles Resend webhook events after signature verification.
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

  // 2. Best-effort idempotency check
  // We check if an event with the same resendEmailId and type already exists.
  // Note: multiple events of same type for same email_id might be rare but possible in some providers.
  // Resend usually sends one for each state change.
  if (resendEmailId) {
      const existingEvent = await ctx.prisma.emailEvent.findFirst({
          where: {
              resendEmailId,
              type
          }
      });

      if (existingEvent) {
          logger.info(`[handleResendWebhook] Duplicate event detected and ignored: ${type}`, { email_id: resendEmailId });
          return ok({
              received: true,
              accepted: true,
              duplicate: true,
              idempotency: "best_effort"
          });
      }
  }

  logger.info(`[handleResendWebhook] Received event: ${type}`, { email_id: resendEmailId, event_id: eventId });

  try {
    // 3. Log the event
    await ctx.prisma.emailEvent.create({
      data: {
        type,
        resendEmailId,
        email: data.to?.[0],
        payload: input as any,
      }
    });

    // 4. Normalize and handle specific events
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
      return ok({
          received: true,
          accepted: true,
          ignored: true,
          idempotency: "best_effort"
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

    return ok({
        received: true,
        accepted: true,
        duplicate: false,
        idempotency: "best_effort"
    });
  } catch (error: any) {
    logger.error("[handleResendWebhook] Error processing webhook", error);
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
}
