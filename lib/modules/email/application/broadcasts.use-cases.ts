import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { recordAuditEvent } from "../../audit";
import { isPrismaErrorCode } from "@/lib/utils/db";
import { APP_NAME } from "@/lib/constants";
import { buildContentUnsubscribeUrl, buildOneClickUnsubscribeUrl } from "@/lib/modules/subscriptions";
import {
  AdminBroadcastEmailListItemDto,
  CreateBroadcastInput,
  CreateBroadcastResult,
  SendBroadcastTestInput,
} from "../domain/email.dto";
import {
  BroadcastInProgressError,
  BroadcastNotFoundError,
  EmailError,
  EmailProviderError,
  InvalidBroadcastPayloadError,
  NoRecipientsError,
} from "../domain/email.errors";
import { BROADCAST_TEMPLATE_DEFINITION } from "../domain/email-template-registry";
import { validateTemplateVariables } from "../domain/render-email";
import { renderBroadcastMessage } from "../domain/broadcast-message";
import { findEligibleRecipients } from "../infrastructure/broadcast-audience";
import { summarizeRecipientStatuses } from "../infrastructure/broadcast-queue.repository";
import { EMAIL_SENDER_NAME, sendEmail } from "../infrastructure/resend-email.transport";

/**
 * Admin broadcasts. Creating one only writes the broadcast and its recipients (PENDING) and returns;
 * the cron queue (/api/cron/send-broadcasts, processBroadcastQueue) sends them. Recipients are the
 * one group the law allows: people who turned on content notifications and are not blocked.
 */

const ACTIVE_STATUSES = ["READY", "SENDING"] as const;

function contentProblem(input: { subjectPl: string; htmlPl: string; subjectEn?: string | null; htmlEn?: string | null }) {
  if (!input.subjectPl.trim() || !input.htmlPl.trim()) return "Temat i treść po polsku są wymagane.";
  const hasEnSubject = Boolean(input.subjectEn?.trim());
  const hasEnHtml = Boolean(input.htmlEn?.trim());
  if (hasEnSubject !== hasEnHtml) return "Wersja angielska musi mieć i temat, i treść (albo zostaw obie puste).";
  const problems = validateTemplateVariables(BROADCAST_TEMPLATE_DEFINITION, {
    subject: input.subjectPl,
    html: input.htmlPl,
    subjectEn: input.subjectEn,
    htmlEn: input.htmlEn,
  });
  if (problems.unknown.length > 0) {
    return `Nieznane zmienne: ${problems.unknown.map((key) => `{{${key}}}`).join(", ")}.`;
  }
  return null;
}

export async function countBroadcastAudience(ctx: AppContext): Promise<UseCaseResult<{ recipientCount: number }, never>> {
  const recipients = await findEligibleRecipients(ctx.prisma);
  return ok({ recipientCount: recipients.length });
}

export async function createBroadcast(
  ctx: AppContext,
  input: CreateBroadcastInput,
): Promise<UseCaseResult<CreateBroadcastResult, EmailError>> {
  const problem = contentProblem(input);
  if (problem) return fail(new InvalidBroadcastPayloadError(problem));

  // The same click arriving twice (double click, retry after a timeout) returns the first broadcast.
  const existing = await ctx.prisma.broadcastEmail.findUnique({
    where: { requestKey: input.requestKey },
    select: { id: true, recipientCount: true },
  });
  if (existing) return ok({ broadcastId: existing.id, recipientCount: existing.recipientCount, duplicate: true });

  const active = await ctx.prisma.broadcastEmail.findFirst({
    where: { status: { in: [...ACTIVE_STATUSES] } },
    select: { id: true },
  });
  if (active) return fail(new BroadcastInProgressError());

  const recipients = await findEligibleRecipients(ctx.prisma);
  if (recipients.length === 0) return fail(new NoRecipientsError());

  const adminUserId = ctx.actor.type === "admin" || ctx.actor.type === "user" ? ctx.actor.userId : null;
  const subjectEn = input.subjectEn?.trim() ? input.subjectEn : "";
  const htmlEn = input.htmlEn?.trim() ? input.htmlEn : "";

  let broadcastId: string;
  try {
    broadcastId = await ctx.db.writeTransaction(async (tx) => {
      const broadcast = await tx.broadcastEmail.create({
        data: {
          subjectPl: input.subjectPl,
          htmlPl: input.htmlPl,
          subjectEn,
          htmlEn,
          recipientGroup: "SUBSCRIBERS",
          recipientCount: recipients.length,
          status: "READY",
          requestKey: input.requestKey,
          createdById: adminUserId,
        },
        select: { id: true },
      });
      await tx.broadcastEmailRecipient.createMany({
        data: recipients.map((r) => ({
          broadcastEmailId: broadcast.id,
          userId: r.userId,
          email: r.email,
          language: r.language,
          status: "PENDING" as const,
        })),
      });
      await recordAuditEvent(ctx, {
        action: "BROADCAST_CREATED",
        targetType: "BroadcastEmail",
        targetId: broadcast.id,
        metadata: { recipientCount: recipients.length },
      }, tx);
      return broadcast.id;
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      const raced = await ctx.prisma.broadcastEmail.findUnique({ where: { requestKey: input.requestKey }, select: { id: true, recipientCount: true } });
      if (raced) return ok({ broadcastId: raced.id, recipientCount: raced.recipientCount, duplicate: true });
    }
    throw error;
  }

  return ok({ broadcastId, recipientCount: recipients.length, duplicate: false });
}

/**
 * Test mail to the signed-in admin's own address, rendered by exactly the same code as the real
 * broadcast (footer, plain text, List-Unsubscribe), in the chosen language.
 */
export async function sendBroadcastTest(
  ctx: AppContext,
  input: SendBroadcastTestInput,
): Promise<UseCaseResult<{ messageId: string | null; to: string }, EmailError>> {
  const problem = contentProblem(input);
  if (problem) return fail(new InvalidBroadcastPayloadError(problem));

  // Only the signed-in admin's own address, never one from the request. The panel passes the address of its
  // own admin account (`recipient`); the old /admin looks up the site account behind the session.
  const adminUserId = ctx.actor.type === "admin" || ctx.actor.type === "user" ? ctx.actor.userId : null;
  const admin = input.recipient
    ? { name: input.recipient.name, email: input.recipient.email }
    : adminUserId
      ? await ctx.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } })
      : null;
  if (!adminUserId || !admin?.email) {
    return fail(new InvalidBroadcastPayloadError("Konto admina nie ma adresu e-mail."));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // A panel account is not a site account: its test mail carries the generic page, never a token for a user id.
  const pageUrl = (!input.recipient && buildContentUnsubscribeUrl(adminUserId, appUrl)) || new URL("/unsubscribe", appUrl).toString();
  const oneClickUrl = (!input.recipient && buildOneClickUnsubscribeUrl(adminUserId, appUrl)) || pageUrl;

  const message = renderBroadcastMessage(
    { subjectPl: input.subjectPl, htmlPl: input.htmlPl, subjectEn: input.subjectEn ?? "", htmlEn: input.htmlEn ?? "" },
    {
      language: input.language,
      nickname: admin.name,
      email: admin.email,
      appName: APP_NAME,
      brandName: EMAIL_SENDER_NAME,
      appUrl,
      unsubscribePageUrl: pageUrl,
    },
  );

  const sent = await sendEmail({
    to: admin.email,
    subject: `[TEST] ${message.subject}`,
    html: message.html,
    language: message.language,
    kind: "broadcast-test",
    stream: "news",
    unsubscribe: { oneClickUrl, footerHtml: message.footerHtml },
  });
  if (!sent.ok) return fail(new EmailProviderError(`Resend odrzucił wiadomość testową (${sent.error.name ?? sent.error.message}).`));

  await recordAuditEvent(ctx, {
    action: "BROADCAST_TEST_SENT",
    targetType: "Email",
    metadata: { language: input.language },
  });
  return ok({ messageId: sent.id, to: admin.email });
}

/** Stops a broadcast: recipients not sent yet are skipped. Mails already sent stay sent. */
export async function cancelBroadcast(
  ctx: AppContext,
  broadcastId: string,
): Promise<UseCaseResult<{ cancelled: true; skipped: number }, EmailError>> {
  const broadcast = await ctx.prisma.broadcastEmail.findUnique({ where: { id: broadcastId }, select: { id: true, status: true } });
  if (!broadcast) return fail(new BroadcastNotFoundError());
  if (!ACTIVE_STATUSES.includes(broadcast.status as (typeof ACTIVE_STATUSES)[number])) {
    return fail(new EmailError("Ta rozsyłka już się zakończyła.", 409, "EMAIL_BROADCAST_NOT_ACTIVE"));
  }

  const skipped = await ctx.db.writeTransaction(async (tx) => {
    await tx.broadcastEmail.update({
      where: { id: broadcastId },
      data: { status: "CANCELLED", lockedUntil: null, nextRunAt: null },
    });
    const { count } = await tx.broadcastEmailRecipient.updateMany({
      where: { broadcastEmailId: broadcastId, status: "PENDING" },
      data: { status: "SKIPPED", error: "CANCELLED" },
    });
    await recordAuditEvent(ctx, {
      action: "BROADCAST_CANCELLED",
      targetType: "BroadcastEmail",
      targetId: broadcastId,
      metadata: { skipped: count },
    }, tx);
    return count;
  });

  return ok({ cancelled: true, skipped });
}

/** History with counts computed from the recipients (no running totals that can drift). */
export async function listAdminBroadcastEmails(
  ctx: AppContext,
): Promise<UseCaseResult<AdminBroadcastEmailListItemDto[], never>> {
  const broadcasts = await ctx.prisma.broadcastEmail.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const grouped = broadcasts.length
    ? await ctx.prisma.broadcastEmailRecipient.groupBy({
        by: ["broadcastEmailId", "status"],
        where: { broadcastEmailId: { in: broadcasts.map((b) => b.id) } },
        _count: true,
      })
    : [];

  return ok(
    broadcasts.map((b) => ({
      id: b.id,
      subjectPl: b.subjectPl,
      subjectEn: b.subjectEn,
      htmlPl: b.htmlPl,
      htmlEn: b.htmlEn,
      status: b.status,
      recipientCount: b.recipientCount,
      counts: summarizeRecipientStatuses(
        grouped.filter((g) => g.broadcastEmailId === b.id).map((g) => ({ status: g.status, _count: g._count })),
      ),
      sentAt: b.sentAt,
      createdAt: b.createdAt,
      createdById: b.createdById,
    })),
  );
}
