import { logger } from "@/lib/logger";
import { escapeHtml } from "../domain/email-content";
import { sendEmail } from "../infrastructure/resend-email.transport";

/**
 * Mail about moderation decisions (DSA art. 16 and 17): to the channel owner when staff decided something about the
 * channel or a video, and to the person who reported content (receipt and outcome). Service mail: no unsubscribe link,
 * never marketing. Pure builders (`build*`) are separate from the senders so they are trivially testable. The text
 * carries only the public statement of reasons, never an internal note.
 */

type Lang = "pl" | "en";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const paragraphs = (text: string) => escapeHtml(text).replace(/\n/g, "<br>");

export type ModerationEmailInput = {
  to: string;
  language: Lang;
  /** Human readable decision, e.g. "Kanał został zawieszony". */
  headline: string;
  /** What it is about: channel or video title. */
  subject: string | null;
  /** The public statement of reasons (ModerationDecision.reasonPublic). */
  reasonPublic: string;
  decisionId: string;
  /** Whether the decision can be appealed (appeal outcomes cannot). */
  appealable: boolean;
};

export function buildModerationDecisionEmail(input: ModerationEmailInput): { subject: string; html: string } {
  const pl = input.language === "pl";
  const link = `${appUrl()}/studio?section=decisions`;
  const subject = pl ? "Decyzja moderacyjna dotycząca Twojego kanału" : "A moderation decision about your channel";
  const appeal = input.appealable
    ? pl
      ? `<p>Jeśli się z nią nie zgadzasz, możesz się odwołać w ciągu 6 miesięcy od decyzji: Studio, sekcja „Decyzje i odwołania” (<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>). Odwołanie rozpatruje człowiek.</p>`
      : `<p>If you disagree, you can appeal within 6 months of the decision: Studio, section "Decisions and appeals" (<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>). A person reviews every appeal.</p>`
    : "";
  const html =
    `<p><strong>${escapeHtml(input.headline)}</strong>${input.subject ? ` (${escapeHtml(input.subject)})` : ""}</p>` +
    `<p>${pl ? "Uzasadnienie" : "Statement of reasons"}:</p><blockquote>${paragraphs(input.reasonPublic)}</blockquote>` +
    appeal +
    `<p style="color:#666">${pl ? "Identyfikator decyzji" : "Decision ID"}: ${escapeHtml(input.decisionId)}</p>`;
  return { subject, html };
}

export async function sendModerationDecisionEmail(input: ModerationEmailInput): Promise<{ ok: boolean }> {
  const { subject, html } = buildModerationDecisionEmail(input);
  const res = await sendEmail({
    to: input.to,
    subject: oneLine(subject),
    html,
    language: input.language,
    kind: "moderation-decision",
    idempotencyKey: `moderation-decision-${input.decisionId}`,
  });
  if (!res.ok) logger.error("[email] moderation decision mail failed", { name: res.error.name, statusCode: res.error.statusCode });
  return { ok: res.ok };
}

export type ReporterEmailInput = {
  to: string;
  language: Lang;
  reportId: string;
  /** "received" right after the report, "decided" with the outcome. */
  stage: "received" | "decided";
  /** Outcome text for `decided`: whether action was taken and the public statement of reasons. */
  actionTaken?: boolean;
  reasonPublic?: string;
  decisionId?: string;
};

export function buildReporterEmail(input: ReporterEmailInput): { subject: string; html: string } {
  const pl = input.language === "pl";
  const id = `<p style="color:#666">${pl ? "Identyfikator zgłoszenia" : "Report ID"}: ${escapeHtml(input.reportId)}</p>`;
  if (input.stage === "received") {
    return {
      subject: pl ? "Potwierdzenie przyjęcia zgłoszenia" : "We received your report",
      html:
        `<p>${pl ? "Dziękujemy. Otrzymaliśmy Twoje zgłoszenie treści i rozpatrzy je człowiek. Poinformujemy Cię o decyzji tym samym adresem e-mail." : "Thank you. We received your report and a person will review it. We will tell you the decision at this address."}</p>` +
        id,
    };
  }
  const outcome = input.actionTaken
    ? pl ? "Zgłoszenie zostało uwzględnione: podjęliśmy działanie wobec treści." : "Your report was upheld: we acted on the content."
    : pl ? "Zgłoszenie zostało oddalone: nie stwierdziliśmy naruszenia zasad." : "Your report was dismissed: we did not find a violation of the rules.";
  return {
    subject: pl ? "Decyzja w sprawie Twojego zgłoszenia" : "The decision on your report",
    html:
      `<p><strong>${escapeHtml(outcome)}</strong></p>` +
      (input.reasonPublic ? `<p>${pl ? "Uzasadnienie" : "Statement of reasons"}:</p><blockquote>${paragraphs(input.reasonPublic)}</blockquote>` : "") +
      `<p>${pl ? "Jeśli się z tą decyzją nie zgadzasz, możesz skorzystać z pozasądowego rozstrzygania sporów (art. 21 DSA) albo drogi sądowej." : "If you disagree with this decision, you can use out-of-court dispute settlement (DSA art. 21) or go to court."}</p>` +
      id +
      (input.decisionId ? `<p style="color:#666">${pl ? "Identyfikator decyzji" : "Decision ID"}: ${escapeHtml(input.decisionId)}</p>` : ""),
  };
}

export async function sendReporterEmail(input: ReporterEmailInput): Promise<{ ok: boolean }> {
  const { subject, html } = buildReporterEmail(input);
  const res = await sendEmail({
    to: input.to,
    subject: oneLine(subject),
    html,
    language: input.language,
    kind: "report-notice",
    idempotencyKey: `report-${input.stage}-${input.reportId}`,
  });
  if (!res.ok) logger.error("[email] reporter mail failed", { name: res.error.name, statusCode: res.error.statusCode });
  return { ok: res.ok };
}
