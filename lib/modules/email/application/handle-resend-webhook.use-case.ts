import { AppContext } from "../../shared/app-context";
import { ResendWebhookInput, ResendWebhookResult } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError, WebhookUnsupportedEventError } from "../domain/email.errors";
import { logger } from "@/lib/logger";

/**
 * handleResendWebhook use case.
 * R9 foundation: handles Resend webhook events after signature verification.
 */
export async function handleResendWebhook(
  ctx: AppContext,
  input: ResendWebhookInput
): Promise<UseCaseResult<ResendWebhookResult, EmailError>> {
  const { type, data } = input;
  const resendEmailId = data.email_id;

  logger.info(`[handleResendWebhook] Received event: ${type}`, { email_id: resendEmailId });

  try {
    // 1. Log the event
    await ctx.prisma.emailEvent.create({
      data: {
        type,
        resendEmailId,
        email: data.to?.[0],
        payload: input as any,
      }
    });

    // 2. Normalize and handle specific events
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
      return ok({ received: true, accepted: true, ignored: true });
    }

    switch (type) {
      case 'email.sent':
        await updateRecipientStatus(ctx, resendEmailId, 'SENT', { sentAt: new Date() });
        break;
      case 'email.delivered':
        await updateRecipientStatus(ctx, resendEmailId, 'DELIVERED', { deliveredAt: new Date() });
        break;
      case 'email.delivery_delayed':
        // We log it but don't necessarily update status to an error one yet
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

    return ok({ received: true, accepted: true });
  } catch (error: any) {
    logger.error("[handleResendWebhook] Error processing webhook", error);
    // Return fail only for internal errors that might warrant a retry from Resend
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
