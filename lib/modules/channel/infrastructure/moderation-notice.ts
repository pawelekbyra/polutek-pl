import { logger } from "@/lib/logger";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { sendNotification } from "@/lib/modules/notifications";
import { describeDecisionAction, isAlwaysNotifiedAction, isAppealOutcomeAction } from "../domain/moderation-appeal.policy";

/**
 * Tells people about a moderation decision AFTER it was committed (DSA art. 16 and 17). Everything here is best
 * effort: a failure is logged and never undoes the decision or reaches the caller. Only the PUBLIC statement of
 * reasons leaves the system; internal notes never do.
 */

export const DECISIONS_HREF = "/studio?section=decisions";

export type DecisionNoticeInput = {
  decisionId: string;
  channelId: string;
  videoId?: string | null;
  action: string;
  reasonPublic: string;
  /** Title of the video or name of the channel the decision is about, for the mail. */
  subjectLabel?: string | null;
  /** Notify this account instead of the channel owner (the person who appealed). */
  recipientUserId?: string | null;
};

type Recipient = { userId: string; email: string | null; language: string | null; channelName: string };

async function loadOwner(ctx: AppContext, channelId: string, recipientUserId?: string | null): Promise<Recipient | null> {
  if (recipientUserId) {
    const user = await ctx.prisma.user.findUnique({ where: { id: recipientUserId }, select: { email: true, language: true, isDeleted: true } });
    if (!user || user.isDeleted) return null;
    return { userId: recipientUserId, email: user.email ?? null, language: user.language ?? null, channelName: "" };
  }
  const channel = await ctx.prisma.creator.findUnique({
    where: { id: channelId },
    select: { name: true, userId: true, user: { select: { email: true, language: true, isDeleted: true } } },
  });
  if (!channel?.userId || channel.user?.isDeleted) return null;
  return { userId: channel.userId, email: channel.user?.email ?? null, language: channel.user?.language ?? null, channelName: channel.name };
}

export async function notifyChannelOwnerOfDecision(ctx: AppContext, input: DecisionNoticeInput): Promise<void> {
  try {
    const owner = await loadOwner(ctx, input.channelId, input.recipientUserId);
    if (!owner) return;
    const headline = describeDecisionAction(input.action);
    const reason = input.reasonPublic.slice(0, 500);
    const always = isAlwaysNotifiedAction(input.action);

    await sendNotification(
      {
        userId: owner.userId,
        kind: "MODERATION",
        titlePl: headline,
        titleEn: "A moderation decision about your channel",
        bodyPl: `${reason}\n\nMożesz się odwołać w sekcji „Decyzje i odwołania” w Studiu.`,
        bodyEn: `${reason}\n\nYou can appeal in the "Decisions and appeals" section of the Studio.`,
        href: DECISIONS_HREF,
        channelId: input.channelId,
        videoId: input.videoId ?? undefined,
        force: always,
        skipTemplate: true,
      },
      ctx.prisma as never,
    );

    if (!owner.email) return;
    const email = await import("@/lib/modules/email");
    await email.sendModerationDecisionEmail({
      to: owner.email,
      language: owner.language === "pl" ? "pl" : "en",
      headline,
      subject: input.subjectLabel ?? (owner.channelName || null),
      reasonPublic: reason,
      decisionId: input.decisionId,
      appealable: !isAppealOutcomeAction(input.action),
    });
  } catch (error) {
    logger.error("[moderation-notice] owner notification failed", { decisionId: input.decisionId, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Mail to the person who reported content: the outcome of their report (the receipt is sent at creation). */
export async function notifyReporterOfDecision(
  ctx: AppContext,
  input: { reportId: string; reporterId: string | null; reporterEmail: string | null; actionTaken: boolean; reasonPublic: string; decisionId: string },
): Promise<void> {
  try {
    const recipient = await resolveReporterAddress(ctx, input.reporterId, input.reporterEmail);
    if (!recipient) return;
    const email = await import("@/lib/modules/email");
    await email.sendReporterEmail({
      to: recipient.email,
      language: recipient.language === "pl" ? "pl" : "en",
      reportId: input.reportId,
      stage: "decided",
      actionTaken: input.actionTaken,
      reasonPublic: input.reasonPublic.slice(0, 500),
      decisionId: input.decisionId,
    });
  } catch (error) {
    logger.error("[moderation-notice] reporter notification failed", { reportId: input.reportId, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Mail to the reporter right after the report was stored: the receipt (DSA art. 16(4)). */
export async function sendReportReceipt(
  ctx: AppContext,
  input: { reportId: string; reporterId: string | null; reporterEmail?: string | null },
): Promise<void> {
  try {
    const recipient = await resolveReporterAddress(ctx, input.reporterId, input.reporterEmail ?? null);
    if (!recipient) return;
    const email = await import("@/lib/modules/email");
    await email.sendReporterEmail({
      to: recipient.email,
      language: recipient.language === "pl" ? "pl" : "en",
      reportId: input.reportId,
      stage: "received",
    });
  } catch (error) {
    logger.error("[moderation-notice] report receipt failed", { reportId: input.reportId, error: error instanceof Error ? error.message : String(error) });
  }
}

async function resolveReporterAddress(
  ctx: AppContext,
  reporterId: string | null,
  reporterEmail: string | null,
): Promise<{ email: string; language: string | null } | null> {
  if (reporterId) {
    const user = await ctx.prisma.user.findUnique({ where: { id: reporterId }, select: { email: true, language: true, isDeleted: true } });
    if (user && !user.isDeleted && user.email) return { email: user.email, language: user.language };
  }
  const email = reporterEmail?.trim();
  return email && email.includes("@") ? { email, language: null } : null;
}
