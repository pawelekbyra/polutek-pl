import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Resend webhook types based on their documentation
type ResendWebhookPayload = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For tracking events
    status?: string;
    // For inbound
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    attachments?: any[];
  };
};

export async function POST(req: NextRequest) {
  // Webhook signature verification
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const receivedSecret = req.headers.get('x-resend-webhook-secret');

  if (process.env.NODE_ENV === 'production' && !secret) {
      logger.error("[ResendWebhook] RESEND_WEBHOOK_SECRET is required in production.");
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (!secret || receivedSecret !== secret) {
      logger.warn("[ResendWebhook] Unauthorized access attempt - invalid secret.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = (await req.json()) as ResendWebhookPayload;
    const { type, data } = payload;
    const resendEmailId = data.email_id;

    logger.info(`[ResendWebhook] Received event: ${type}`, { email_id: resendEmailId });

    // 1. Log the event
    await prisma.emailEvent.create({
      data: {
        type,
        resendEmailId,
        email: data.to?.[0],
        payload: payload as any,
      }
    });

    // 2. Handle specific events
    switch (type) {
      case 'email.sent':
        await updateRecipientStatus(resendEmailId, 'SENT', { sentAt: new Date() });
        break;
      case 'email.delivered':
        await updateRecipientStatus(resendEmailId, 'DELIVERED', { deliveredAt: new Date() });
        break;
      case 'email.bounced':
        await updateRecipientStatus(resendEmailId, 'BOUNCED', { bouncedAt: new Date() }, true);
        break;
      case 'email.complained':
        await updateRecipientStatus(resendEmailId, 'COMPLAINED', { complainedAt: new Date() }, true);
        break;
      case 'email.opened':
        await updateRecipientStatus(resendEmailId, 'OPENED', { openedAt: new Date() });
        break;
      case 'email.clicked':
        await updateRecipientStatus(resendEmailId, 'CLICKED', { clickedAt: new Date() });
        break;
      case 'email.unsubscribed':
        await handleUnsubscribe(data.to?.[0]);
        break;
      case 'email.received':
        await handleInboundEmail(data);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("[ResendWebhook] Error processing webhook", error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function updateRecipientStatus(resendEmailId: string, status: any, extraData: any = {}, isError = false) {
  const recipient = await prisma.broadcastEmailRecipient.findFirst({
    where: { resendEmailId }
  });

  if (!recipient) return;

  await prisma.broadcastEmailRecipient.update({
    where: { id: recipient.id },
    data: {
      status,
      ...extraData
    }
  });

  // Update aggregate counts in BroadcastEmail
  if (status === 'SENT') {
    await prisma.broadcastEmail.update({
        where: { id: recipient.broadcastEmailId },
        data: { sentCount: { increment: 1 } }
    });
  } else if (isError) {
    await prisma.broadcastEmail.update({
        where: { id: recipient.broadcastEmailId },
        data: { errorCount: { increment: 1 } }
    });
  }
}

async function handleUnsubscribe(email: string) {
    if (!email) return;
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.emailPreference.upsert({
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

async function handleInboundEmail(data: any) {
    const user = await prisma.user.findUnique({ where: { email: data.from } });
    await prisma.inboundEmail.create({
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
