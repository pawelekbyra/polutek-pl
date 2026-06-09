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

  const { type, data } = input;

  if (!type || typeof type !== 'string') {
      return fail(new WebhookInvalidPayloadError("Event type is required and must be a string"));
  }

  if (!data || typeof data !== 'object') {
      return fail(new WebhookInvalidPayloadError("Event data is required and must be an object"));
  }

  const resendEmailId = data.email_id;
  if (!resendEmailId) {
      // Some events might not have email_id? According to Resend docs they should.
      // But we must handle it safely.
      logger.warn(`[handleResendWebhook] Event ${type} missing email_id`);
  }

  logger.info(`[handleResendWebhook] Received event: ${type}`, { email_id: resendEmailId });

  try {
    // 2. Log the event
    await ctx.prisma.emailEvent.create({
      data: {
        type,
        resendEmailId,
        email: data.to?.[0],
        payload: input as any,
      }
    });

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
      return ok({
          received: true,
          accepted: true,
          ignored: true,
          idempotency: "not_available"
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
        idempotency: "not_available" // Durable idempotency requires future schema support
    });
  } catch (error: any) {
    logger.error("[handleResendWebhook] Error processing webhook", error);
    return fail(new EmailError(error.message || "Internal error during webhook handling"));
  }
}

async function updateRecipientStatus(ctx: AppContext, resendEmailId: string, status: any, extraData: any = {}, isError = false) {
  const recipient = await ctx.prisma.broadcastEmailRecipient.findFirst({
    where: { resendEmailId }
  });

  if (!recipient) return;

  await ctx.prisma.broadcastEmailRecipient.update({
    where: { id: recipient.id },
    data: {
      status,
      ...extraData
    }
  });

  // Update aggregate counts in BroadcastEmail
  if (status === 'SENT') {
    await ctx.prisma.broadcastEmail.update({
        where: { id: recipient.broadcastEmailId },
        data: { sentCount: { increment: 1 } }
    });
  } else if (isError) {
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
