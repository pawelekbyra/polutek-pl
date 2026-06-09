import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { requireAdminForApi } from '@/lib/auth-utils';
import { sendAdminBroadcastEmail, listAdminBroadcastEmails, BroadcastAudience } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_EMAILS_BROADCAST");
  if (response) return response;

  const body = await req.json();
  const schema = z.object({
      subject: z.string().optional(),
      body: z.string().optional(),
      audience: z.enum(['ALL_SUBSCRIBERS', 'PATRONS', 'NON_PATRONS', 'TEST', 'MANUAL']).optional(),
      testRecipientEmail: z.string().email().optional().nullable(),
      manualRecipients: z.array(z.object({
          email: z.string().email(),
          name: z.string().optional().nullable()
      })).optional(),
      dryRun: z.boolean().optional(),
      // Backward compatibility mapping
      subjectPl: z.string().optional(),
      htmlPl: z.string().optional(),
      subjectEn: z.string().optional(),
      htmlEn: z.string().optional(),
      recipientGroup: z.enum(['ALL', 'SUBSCRIBERS', 'PATRONS', 'MANUAL']).optional(),
      isTest: z.boolean().optional(),
      testEmail: z.string().email().optional().nullable(),
      manualEmails: z.string().optional().nullable()
  });

  const validated = schema.safeParse(body);
  if (!validated.success) {
      return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 });
  }

  // Map incoming request to AdminBroadcastEmailInput
  const data = validated.data;

  // Resolve audience
  let audience: BroadcastAudience = (data.audience as BroadcastAudience) || "TEST";
  if (!data.audience && data.recipientGroup) {
      if (data.recipientGroup === 'ALL') audience = "ALL_SUBSCRIBERS";
      else if (data.recipientGroup === 'SUBSCRIBERS') audience = "ALL_SUBSCRIBERS";
      else if (data.recipientGroup === 'PATRONS') audience = "PATRONS";
      else if (data.recipientGroup === 'MANUAL') audience = "MANUAL";
  }
  if (data.isTest) audience = "TEST";

  const input = {
      subject: data.subject || data.subjectPl || '',
      body: data.body || data.htmlPl || '',
      audience,
      testRecipientEmail: data.testRecipientEmail || data.testEmail,
      manualRecipients: data.manualRecipients,
      dryRun: data.dryRun,
      requestedByAdminId: adminUserId,
      // Pass raw legacy fields too
      subjectPl: data.subjectPl,
      htmlPl: data.htmlPl,
      subjectEn: data.subjectEn,
      htmlEn: data.htmlEn,
      manualEmails: data.manualEmails,
  };

  const ctx = createAppContext({
      actor: { type: 'admin', userId: adminUserId }
  });

  // If testEmail is missing and it's a test, try to get it from session
  if (input.audience === "TEST" && !input.testRecipientEmail) {
      const { sessionClaims } = await auth();
      input.testRecipientEmail = sessionClaims?.email as string;
  }

  const result = await sendAdminBroadcastEmail(ctx, input);

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

  const ctx = createAppContext({
      actor: { type: 'system', reason: 'Admin History Request' }
  });

  const result = await listAdminBroadcastEmails(ctx);

  if (!result.ok) {
      return NextResponse.json(
          { error: result.error.message, code: result.error.code },
          { status: result.error.statusCode }
      );
  }

  return NextResponse.json(result.data);
}
