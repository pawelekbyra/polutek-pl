import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { APP_NAME } from '@/lib/constants';
import { requireAdminForApi } from '@/lib/auth-utils';
import { EmailService } from '@/lib/services/email.service';
import { writeAuditLog } from '@/lib/services/audit.service';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }
  return new Resend(apiKey);
}

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_EMAILS_BROADCAST");
  if (response) return response;

  const body = await req.json();
  const schema = z.object({
      subjectPl: z.string().min(1),
      htmlPl: z.string().min(1),
      subjectEn: z.string().min(1),
      htmlEn: z.string().min(1),
      recipientGroup: z.enum(['ALL', 'SUBSCRIBERS', 'PATRONS', 'MANUAL']).optional(),
      isTest: z.boolean().optional(),
      testEmail: z.string().email().optional().nullable(),
      manualEmails: z.string().optional().nullable()
  });

  const validated = schema.safeParse(body);
  if (!validated.success) {
      return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 });
  }

  const { subjectPl, htmlPl, subjectEn, htmlEn, recipientGroup, isTest, testEmail, manualEmails } = validated.data;

  if (!subjectPl || !htmlPl || !subjectEn || !htmlEn) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 });
  }

  try {
    if (isTest) {
        const resend = getResendClient();
        const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;
        const targetEmail = testEmail || (await auth()).sessionClaims?.email as string;

        await resend.emails.send({
            from,
            to: [targetEmail],
            subject: `[TEST] ${subjectPl}`,
            html: htmlPl
        });

        await writeAuditLog({
            actorUserId: adminUserId,
            action: "BROADCAST_TEST_SENT",
            targetType: "Email",
            metadata: { testEmail: targetEmail, subject: subjectPl }
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
        createdById: adminUserId
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

    await writeAuditLog({
        actorUserId: adminUserId,
        action: "BROADCAST_CREATED",
        targetType: "BroadcastEmail",
        targetId: broadcast.id,
        metadata: { recipientGroup, recipientCount: subscribers.length, subject: subjectPl }
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
  const { response } = await requireAdminForApi("GET_ADMIN_EMAILS_BROADCAST_HISTORY");
  if (response) return response;

  try {
    const history = await prisma.broadcastEmail.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
