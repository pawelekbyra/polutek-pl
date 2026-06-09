import { AppContext } from "../../shared/app-context";
import { AdminBroadcastEmailInput, AdminBroadcastEmailResult, BroadcastRecipientDto } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import {
    EmailError,
    InvalidBroadcastPayloadError,
    EmailProviderError,
    TestRecipientRequiredError,
    NoRecipientsError
} from "../domain/email.errors";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/constants";
import { Resend } from "resend";
import { recordAuditEvent } from "@/lib/modules/audit";
import { EmailRepository } from "../infrastructure/email.repository";
import { LegacyEmailServiceProvider } from "../infrastructure/legacy-email-service-provider";

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
 *
 * Future R9 pass should split provider adapter, templates, delivery logs,
 * retry/outbox and durable webhook idempotency.
 */
export async function sendAdminBroadcastEmail(
  ctx: AppContext,
  input: AdminBroadcastEmailInput
): Promise<UseCaseResult<AdminBroadcastEmailResult, EmailError>> {
  const {
    subject, body,
    audience, testRecipientEmail, dryRun,
    requestedByAdminId,
    // Support for legacy mapping
    subjectPl, htmlPl, subjectEn, htmlEn,
    manualEmails
  } = input;

  const adminUserId = requestedByAdminId || ((ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : 'system');

  // 1. Validation
  if (!subject || (!body && !htmlPl)) {
    return fail(new InvalidBroadcastPayloadError("Subject and body/content are required"));
  }

  if (audience === "TEST" && !testRecipientEmail) {
    return fail(new TestRecipientRequiredError());
  }

  try {
    const repository = new EmailRepository(ctx.prisma);
    const provider = new LegacyEmailServiceProvider();

    // 2. Audience / Recipient selection
    let recipients: BroadcastRecipientDto[] = [];

    if (audience === "TEST" && testRecipientEmail) {
      recipients = [{
        email: testRecipientEmail,
        language: 'pl',
        name: testRecipientEmail.split('@')[0],
        isPatron: false,
      }];
    } else if (input.audience as any === 'MANUAL' && manualEmails) {
        const emails = manualEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
        recipients = emails.map((email: string) => ({
          email,
          language: 'pl',
          name: email.split('@')[0],
          isPatron: false,
        }));
    } else {
      recipients = await repository.findRecipientsForAudience(audience);
    }

    if (recipients.length === 0) {
      return ok({
        dryRun: !!dryRun,
        audience,
        recipientCount: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        messageIds: [],
        message: 'No recipients found for this group'
      });
    }

    if (dryRun) {
      return ok({
        dryRun: true,
        audience,
        recipientCount: recipients.length,
        sent: 0,
        skipped: recipients.length,
        failed: 0,
        messageIds: [],
        message: `Dry run: would send to ${recipients.length} recipients`
      });
    }

    // 3. Special handling for TEST via Resend directly (to maintain current behavior)
    if (audience === "TEST") {
      const resend = getResendClient();
      const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@polutek.pl>`;

      await resend.emails.send({
        from,
        to: [testRecipientEmail!],
        subject: `[TEST] ${subject}`,
        html: body || htmlPl || ''
      });

      await recordAuditEvent(ctx, {
        action: "BROADCAST_TEST_SENT",
        targetType: "Email",
        metadata: { testEmail: testRecipientEmail, subject }
      });

      return ok({
        dryRun: false,
        audience,
        recipientCount: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
        messageIds: ['test-id'],
      });
    }

    // 4. Create BroadcastEmail record
    const broadcast = await ctx.prisma.broadcastEmail.create({
      data: {
        subjectPl: subjectPl || subject,
        htmlPl: htmlPl || body,
        subjectEn: subjectEn || subject,
        htmlEn: htmlEn || body,
        recipientGroup: (audience as any) === 'ALL_SUBSCRIBERS' ? 'ALL' : (audience as any),
        recipientCount: recipients.length,
        status: 'READY',
        createdById: adminUserId
      }
    });

    // 5. Create individual recipient records
    await ctx.prisma.broadcastEmailRecipient.createMany({
      data: recipients.map(r => ({
        broadcastEmailId: broadcast.id,
        userId: r.userId,
        email: r.email,
        language: r.language || 'pl',
        status: 'PENDING'
      }))
    });

    // 6. Trigger bridge provider
    await provider.sendBroadcast({
        subject,
        body,
        recipients,
        broadcastId: broadcast.id
    });

    await recordAuditEvent(ctx, {
      action: "BROADCAST_CREATED",
      targetType: "BroadcastEmail",
      targetId: broadcast.id,
      metadata: { audience, recipientCount: recipients.length, subject }
    });

    return ok({
      dryRun: false,
      audience,
      recipientCount: recipients.length,
      sent: recipients.length,
      skipped: 0,
      failed: 0,
      broadcastId: broadcast.id,
      messageIds: []
    });

  } catch (error: any) {
    logger.error("[sendAdminBroadcastEmail] Error", error);
    return fail(new EmailProviderError(error.message || "Internal error during broadcast creation"));
  }
}
