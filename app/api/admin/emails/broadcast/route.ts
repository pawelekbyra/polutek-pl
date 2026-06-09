import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { requireAdminForApi } from '@/lib/auth-utils';
import { sendAdminBroadcastEmail } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';

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

  const ctx = createAppContext({
      actor: { type: 'admin', userId: adminUserId }
  });

  // If testEmail is missing and it's a test, try to get it from session
  if (validated.data.isTest && !validated.data.testEmail) {
      const { sessionClaims } = await auth();
      validated.data.testEmail = sessionClaims?.email as string;
  }

  const result = await sendAdminBroadcastEmail(ctx, validated.data);

  if (!result.ok) {
      return NextResponse.json(
          { error: result.error.message, code: result.error.code },
          { status: result.error.statusCode }
      );
  }

  return NextResponse.json(result.data);
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
