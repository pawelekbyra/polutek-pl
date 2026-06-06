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

import { EmailService } from '@/lib/services/email.service';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const decision = await AccessPolicy.canManageAdmin(userId);

  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const { subjectPl, htmlPl, subjectEn, htmlEn, recipientGroup, isTest, testEmail, manualEmails } = await req.json();

  if (!subjectPl || !htmlPl || !subjectEn || !htmlEn) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 });
  }

  try {
    if (isTest) {
        const resend = getResendClient();
        const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;
        await resend.emails.send({
            from,
            to: [testEmail || (await auth()).sessionClaims?.email as string],
            subject: `[TEST] ${subjectPl}`,
            html: htmlPl
        });
        return NextResponse.json({ success: true, message: 'Test email sent' });
    }

    // 1. Determine recipients based on group
    let subscribers: Array<{ id?: string, email: string, language: string, name?: string | null }> = [];

    if (recipientGroup === 'MANUAL' && manualEmails) {
        const emails = manualEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
        subscribers = emails.map((email: string) => ({
            email,
            language: 'pl', // Default for manual
            name: email.split('@')[0]
        }));
    } else {
        let where: any = { isDeleted: false };
        if (recipientGroup === 'SUBSCRIBERS') {
            where.subscriptions = { some: {} };
        } else if (recipientGroup === 'PATRONS') {
            where.isPatron = true;
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                language: true,
                name: true
            }
        });
        subscribers = users.map(u => ({ ...u, language: u.language || 'pl' }));
    }

    if (subscribers.length === 0) {
      return NextResponse.json({ recipientCount: 0, message: 'No recipients found for this group' });
    }

    // 2. Create BroadcastEmail record
    const broadcast = await prisma.broadcastEmail.create({
      data: {
        subjectPl,
        htmlPl,
        subjectEn,
        htmlEn,
        recipientGroup: recipientGroup || 'SUBSCRIBERS',
        recipientCount: subscribers.length,
        status: 'READY',
        createdById: userId
      }
    });

    // 3. Create individual recipient records
    await prisma.broadcastEmailRecipient.createMany({
        data: subscribers.map(s => ({
            broadcastEmailId: broadcast.id,
            userId: s.id,
            email: s.email,
            language: s.language || 'pl',
            status: 'PENDING'
        }))
    });

    // 4. Trigger background sending (don't await fully to avoid timeout)
    EmailService.sendBroadcast(broadcast.id).catch(err => {
        logger.error(`[BroadcastEmailAPI] Background send failed for ${broadcast.id}`, err);
    });

    return NextResponse.json({
        success: true,
        broadcastId: broadcast.id,
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
