import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AccessPolicy } from '@/lib/access/access-policy';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { APP_NAME } from '@/lib/constants';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }
  return new Resend(apiKey);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const decision = await AccessPolicy.canManageAdmin(userId);

  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const { subjectPl, htmlPl, subjectEn, htmlEn } = await req.json();

  if (!subjectPl || !htmlPl || !subjectEn || !htmlEn) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 });
  }

  try {
    // 1. Get all subscribed users
    // We look for users who have at least one subscription record
    // or we could look for isPatron users if that's the requirement.
    // The user asked for "subskrajberow ktorzy maja zaznaczona subskrybcje".
    const subscribers = await prisma.user.findMany({
      where: {
        isDeleted: false,
        subscriptions: { some: {} }
      },
      select: {
        email: true,
        language: true,
        name: true
      }
    });

    if (subscribers.length === 0) {
      return NextResponse.json({ recipientCount: 0, message: 'No subscribers found' });
    }

    const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;
    const resend = getResendClient();

    // 2. Group by language to send in batches if possible or just loop
    // Resend supports batching up to 100 emails per call.
    const plRecipients = subscribers.filter(s => s.language === 'pl');
    const enRecipients = subscribers.filter(s => s.language !== 'pl');

    const sendPromises = [];

    // Send PL emails
    for (const sub of plRecipients) {
        sendPromises.push(resend.emails.send({
            from,
            to: [sub.email],
            subject: subjectPl,
            html: htmlPl
        }).catch(e => logger.error(`Failed to send PL broadcast to ${sub.email}`, e)));
    }

    // Send EN emails
    for (const sub of enRecipients) {
        sendPromises.push(resend.emails.send({
            from,
            to: [sub.email],
            subject: subjectEn,
            html: htmlEn
        }).catch(e => logger.error(`Failed to send EN broadcast to ${sub.email}`, e)));
    }

    await Promise.all(sendPromises);

    // 3. Save to BroadcastEmail log
    await prisma.broadcastEmail.create({
      data: {
        subjectPl,
        htmlPl,
        subjectEn,
        htmlEn,
        recipientCount: subscribers.length,
        status: 'SENT'
      }
    });

    return NextResponse.json({
        success: true,
        recipientCount: subscribers.length
    });

  } catch (error) {
    logger.error("[BroadcastEmailAPI] Error", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const decision = await AccessPolicy.canManageAdmin(userId);

  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  try {
    const history = await prisma.broadcastEmail.findMany({
      orderBy: { sentAt: 'desc' },
      take: 20
    });
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
