import { AppContext } from "../../shared/app-context";
import { AdminBroadcastEmailInput, AdminBroadcastEmailResult, BroadcastRecipientDto } from "../domain/email.dto";
import { UseCaseResult, ok, fail } from "../../shared/result";
import {
    EmailError,
    InvalidBroadcastPayloadError,
    EmailProviderError,
    TestRecipientRequiredError,
} from "../domain/email.errors";
import { logger } from "@/lib/logger";
import { recordAuditEvent } from "@/lib/modules/audit";
import { EmailRepository } from "../infrastructure/email.repository";
import { LegacyEmailServiceProvider } from "../infrastructure/legacy-email-service-provider";
import { EmailPolicy } from "../domain/email.policy";

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
    manualEmails, manualRecipients
  } = input;

  const adminUserId = requestedByAdminId || ((ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : 'system');

  // 1. Validation
  if (!subject || (!body && !htmlPl)) {
    return fail(new InvalidBroadcastPayloadError("Subject and body/content are required"));
  }

  if (audience === "TEST" && !testRecipientEmail) {
    return fail(new TestRecipientRequiredError());
  }

  if (audience === "MANUAL" && (!manualRecipients || manualRecipients.length === 0) && !manualEmails) {
    return fail(new InvalidBroadcastPayloadError("Recipients are required for MANUAL audience"));
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
    } else if (audience === "MANUAL") {
        if (manualRecipients && manualRecipients.length > 0) {
            recipients = manualRecipients.map(r => ({
                email: r.email,
                language: 'pl',
                name: r.name || r.email.split('@')[0],
                isPatron: false
            }));
        } else if (manualEmails) {
            const emails = manualEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
            recipients = emails.map((email: string) => ({
              email,
              language: 'pl',
              name: email.split('@')[0],
              isPatron: false,
            }));
        }
    } else {
      recipients = await repository.findRecipientsForAudience(audience);
    }

    // Deduplicate recipients by email
    const seenEmails = new Set<string>();
    recipients = recipients.filter(r => {
        if (!r.email || seenEmails.has(r.email.toLowerCase())) return false;
        seenEmails.add(r.email.toLowerCase());
        return true;
    });

    // 3. Apply Domain Policy (Opt-out check)
    // For large lists, this should be optimized. For now we do it per recipient or keep it in bridge.
    // Actually, LegacyEmailServiceProvider calls EmailService which already checks preferences.
    // For R9 certification, we add the boundary check here but keep it async-safe.

    if (audience !== "TEST") {
        const eligibleRecipients: BroadcastRecipientDto[] = [];
        for (const r of recipients) {
            if (await EmailPolicy.canReceiveBroadcastEmail(ctx.prisma, r.email, r.userId)) {
                eligibleRecipients.push(r);
            }
        }
        recipients = eligibleRecipients;
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

    // 4. Handling for TEST via Provider
    if (audience === "TEST") {
      const { messageId } = await provider.sendTestEmail({
        to: testRecipientEmail!,
        subject,
        body: body || htmlPl || ''
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
        messageIds: [messageId],
      });
    }

    // 5. Map audience to DB Enum (BroadcastRecipientGroup)
    let dbGroup: 'ALL' | 'SUBSCRIBERS' | 'PATRONS' | 'MANUAL' = 'SUBSCRIBERS';
    if (audience === 'ALL_SUBSCRIBERS') dbGroup = 'ALL';
    else if (audience === 'PATRONS') dbGroup = 'PATRONS';
    else if (audience === 'MANUAL') dbGroup = 'MANUAL';
    else if (audience === 'NON_PATRONS') dbGroup = 'ALL';

    // 6. Create BroadcastEmail record
    const broadcast = await ctx.prisma.broadcastEmail.create({
      data: {
        subjectPl: subjectPl || subject,
        htmlPl: htmlPl || body,
        subjectEn: subjectEn || subject,
        htmlEn: htmlEn || body,
        recipientGroup: dbGroup,
        recipientCount: recipients.length,
        status: 'READY',
        createdById: adminUserId
      }
    });

    // 7. Create individual recipient records
    await ctx.prisma.broadcastEmailRecipient.createMany({
      data: recipients.map(r => ({
        broadcastEmailId: broadcast.id,
        userId: r.userId,
        email: r.email,
        language: r.language || 'pl',
        status: 'PENDING'
      }))
    });

    // 8. Trigger bridge provider
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

  } catch (error:
any) {
    logger.error("[sendAdminBroadcastEmail] Error", error);
    return fail(new EmailProviderError(error.message || "Internal error during broadcast creation"));
  }
}
