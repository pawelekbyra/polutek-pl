/**
 * Read models and the preview of "Komunikacja" (admin panel, phase 3): default text of a system mail, a
 * preview rendered exactly like a real send, deliverability and limits, unsubscribes and blocks.
 * Nothing here sends mail.
 */
import { bounceEventsConnected, emailSendLimits } from "@/lib/email-config";
import sanitizeHtml from "sanitize-html";
import { EMAIL_DEFAULTS } from "@/lib/email-defaults";
import type { AppContext } from "../../shared/app-context";
import { AppError } from "../../shared/app-error";
import { EmailTemplateDto } from "../domain/email.dto";
import { wrapEmailDocument } from "../domain/email-content";
import { describeVariables, getTemplateDefinition, isSystemTemplateSlug, SYSTEM_TEMPLATE_DEFINITIONS } from "../domain/email-template-registry";
import { renderHtml, renderSubject, validateTemplateVariables, type TemplateVariableProblems } from "../domain/render-email";
import { sanitizeOptions } from "./email-templates.use-cases";
import { EMAIL_IDENTITY_LINE } from "../infrastructure/email.transport";

/** The text of a system mail as it ships in code (what "Przywróć domyślny" returns to); null for admin-made templates. */
export function getEmailTemplateDefault(slug: string): EmailTemplateDto | null {
  if (!isSystemTemplateSlug(slug)) return null;
  const definition = SYSTEM_TEMPLATE_DEFINITIONS[slug];
  return { id: `default-${slug}`, slug, name: definition.name, description: definition.description, isSystem: true, isCustomized: false, ...EMAIL_DEFAULTS[slug], updatedAt: null, variables: describeVariables(definition) };
}

export type TemplatePreview = { subject: string; html: string; problems: TemplateVariableProblems };

/**
 * Preview of a (possibly unsaved) text: sanitized like a save, filled with the sample values of the registry,
 * wrapped in the same document as a real mail. The HTML is for a sandboxed frame with its own CSP, never inlined.
 */
export function previewEmailTemplate(input: { slug: string; language: "pl" | "en"; subject: string; html: string; subjectEn?: string | null; htmlEn?: string | null }): TemplatePreview {
  const definition = getTemplateDefinition(input.slug);
  const values = Object.fromEntries(describeVariables(definition).map((v) => [v.key, v.sample[input.language]]));
  const useEn = input.language === "en" && !!input.subjectEn?.trim() && !!input.htmlEn?.trim();
  const subjectTemplate = useEn ? input.subjectEn! : input.subject;
  const htmlTemplate = sanitizeHtml(useEn ? input.htmlEn! : input.html, sanitizeOptions);
  const subject = renderSubject(subjectTemplate, values);
  return {
    subject,
    html: wrapEmailDocument({ html: renderHtml(htmlTemplate, values), language: useEn ? "en" : "pl", title: subject, identityLine: EMAIL_IDENTITY_LINE }),
    problems: validateTemplateVariables(definition, { subject: input.subject, html: input.html, subjectEn: input.subjectEn, htmlEn: input.htmlEn }),
  };
}

const adminOnly = (ctx: AppContext) => {
  if (ctx.actor.type !== "admin") throw new AppError("Only admins can read mail statistics", 403, "FORBIDDEN");
};

/** Send caps and bounce targets of the active provider (EMAIL_DAILY_LIMIT / EMAIL_MONTHLY_LIMIT, old RESEND_* names still work). */
export function emailLimits(env: Record<string, string | undefined> = process.env) {
  return emailSendLimits(env);
}
/** @deprecated Old name of emailLimits(). */
export const resendLimits = emailLimits;

export type Deliverability = {
  windowDays: 30;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  bounceRate: number | null;
  complaintRate: number | null;
  sentToday: number;
  sentMonth: number;
  limits: ReturnType<typeof emailLimits>;
  /** False when no bounce/complaint events reach the app (SES until the SNS webhook exists): the counters above are then not real. */
  bounceEventsConnected: boolean;
  lastEventAt: string | null;
  /** Broadcast recipients, last 30 days: queue progress rather than provider events. */
  broadcastRecipients: { sent: number; pending: number; failed: number };
};

export async function getDeliverability(ctx: AppContext, now: Date = ctx.now()): Promise<Deliverability> {
  adminOnly(ctx);
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [byType, today, month, last, recipients] = await Promise.all([
    ctx.prisma.emailEvent.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    ctx.prisma.emailEvent.count({ where: { type: "email.sent", createdAt: { gte: dayStart } } }),
    ctx.prisma.emailEvent.count({ where: { type: "email.sent", createdAt: { gte: monthStart } } }),
    ctx.prisma.emailEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ctx.prisma.broadcastEmailRecipient.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const n = (t: string) => byType.find((g) => g.type === t)?._count._all ?? 0;
  const sent = n("email.sent");
  const r = (...s: string[]) => recipients.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  return {
    windowDays: 30,
    sent,
    delivered: n("email.delivered"),
    bounced: n("email.bounced"),
    complained: n("email.complained"),
    failed: n("email.failed"),
    bounceRate: sent ? (n("email.bounced") / sent) * 100 : null,
    complaintRate: sent ? (n("email.complained") / sent) * 100 : null,
    sentToday: today,
    sentMonth: month,
    limits: emailLimits(),
    bounceEventsConnected: bounceEventsConnected(),
    lastEventAt: last?.createdAt.toISOString() ?? null,
    broadcastRecipients: { sent: r("SENT", "DELIVERED", "OPENED", "CLICKED"), pending: r("PENDING"), failed: r("FAILED", "BOUNCED", "COMPLAINED") },
  };
}

export type SuppressionView = {
  blocked: { email: string; reason: string; lastSeenAt: string }[];
  unsubscribed: { email: string; at: string }[];
  counts: { blocked: number; unsubscribed: number; consenting: number };
};

/** Blocks after a bounce or complaint, people who withdrew consent, and how many still consent. */
export async function getSuppressions(ctx: AppContext): Promise<SuppressionView> {
  adminOnly(ctx);
  const [blocked, unsubscribed, nBlocked, nUnsub, consenting] = await Promise.all([
    ctx.prisma.emailSuppression.findMany({ where: { active: true }, orderBy: { lastSeenAt: "desc" }, take: 50, select: { email: true, reason: true, lastSeenAt: true } }),
    ctx.prisma.emailPreference.findMany({ where: { unsubscribedAt: { not: null } }, orderBy: { unsubscribedAt: "desc" }, take: 50, select: { email: true, unsubscribedAt: true } }),
    ctx.prisma.emailSuppression.count({ where: { active: true } }),
    ctx.prisma.emailPreference.count({ where: { unsubscribedAt: { not: null } } }),
    ctx.prisma.emailPreference.count({ where: { marketingEmails: true } }),
  ]);
  return {
    blocked: blocked.map((b) => ({ email: b.email, reason: b.reason, lastSeenAt: b.lastSeenAt.toISOString() })),
    unsubscribed: unsubscribed.map((u) => ({ email: u.email, at: u.unsubscribedAt!.toISOString() })),
    counts: { blocked: nBlocked, unsubscribed: nUnsub, consenting },
  };
}
