import { AppContext } from "../../shared/app-context";
import { AdminBroadcastEmailInput, AdminBroadcastEmailResult } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError, InvalidBroadcastPayloadError, EmailProviderError } from "../domain/email.errors";
import { EmailService } from "@/lib/services/email.service";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/constants";
import { Resend } from "resend";
import { recordAuditEvent } from "@/lib/modules/audit";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }
  return new Resend(apiKey);
}

/**
 * sendAdminBroadcastEmail use case.
 * R9 foundation: handles admin broadcast logic and transitions from route to legacy bridge.
 */
export async function sendAdminBroadcastEmail(
  ctx: AppContext,
  input: AdminBroadcastEmailInput
): Promise<UseCaseResult<AdminBroadcastEmailResult, EmailError>> {
  const {
    subjectPl, htmlPl, subjectEn, htmlEn,
    recipientGroup, isTest, testEmail, manualEmails
  } = input;

  const adminUserId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : 'system';

  try {
    if (isTest) {
      if (!testEmail) {
        return fail(new InvalidBroadcastPayloadError("Test email recipient missing"));
      }

      const resend = getResendClient();
      const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;

      await resend.emails.send({
        from,
        to: [testEmail],
        subject: `[TEST] ${subjectPl}`,
        html: htmlPl
      });

      await recordAuditEvent(ctx, {
        action: "BROADCAST_TEST_SENT",
        targetType: "Email",
        metadata: { testEmail, subject: subjectPl }
      });

      return ok({ success: true, message: 'Test email sent', recipientCount: 1 });
    }

    // 1. Determine recipients based on group
    let subscribers: Array<{ id?: string, email: string, language: string, name?: string | null }> = [];

    if (recipientGroup === 'MANUAL' && manualEmails) {
      const emails = manualEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
      subscribers = emails.map((email: string) => ({
        email,
        language: 'pl',
        name: email.split('@')[0]
      }));
    } else {
      let where: any = { isDeleted: false };
      if (recipientGroup === 'SUBSCRIBERS') {
        where.subscriptions = { some: {} };
      } else if (recipientGroup === 'PATRONS') {
        where.isPatron = true;
      }

      const users = await ctx.prisma.user.findMany({
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
      return ok({ success: true, recipientCount: 0, message: 'No recipients found for this group' });
    }

    // 2. Create BroadcastEmail record
    const broadcast = await ctx.prisma.broadcastEmail.create({
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
    await ctx.prisma.broadcastEmailRecipient.createMany({
      data: subscribers.map(s => ({
        broadcastEmailId: broadcast.id,
        userId: s.id,
        email: s.email,
        language: s.language || 'pl',
        status: 'PENDING'
      }))
    });

    // 4. Trigger background sending (R9 Legacy Bridge)
    /**
     * R9 legacy email bridge.
     * Keeps existing provider/template behavior while moving route ownership to lib/modules/email.
     */
    EmailService.sendBroadcast(broadcast.id).catch(err => {
      logger.error(`[sendAdminBroadcastEmail] Background send failed for ${broadcast.id}`, err);
    });

    await recordAuditEvent(ctx, {
      action: "BROADCAST_CREATED",
      targetType: "BroadcastEmail",
      targetId: broadcast.id,
      metadata: { recipientGroup, recipientCount: subscribers.length, subject: subjectPl }
    });

    return ok({
      success: true,
      broadcastId: broadcast.id,
      recipientCount: subscribers.length
    });

  } catch (error: any) {
    logger.error("[sendAdminBroadcastEmail] Error", error);
    return fail(new EmailProviderError(error.message || "Internal error during broadcast creation"));
  }
}
