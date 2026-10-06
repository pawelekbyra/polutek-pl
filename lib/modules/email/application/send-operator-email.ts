import { sendEmail } from "../infrastructure/email.transport";

/**
 * A system mail to the operator (admin morning report and similar): no unsubscribe footer, never marketing.
 * Callers decide whether to send at all (the morning report is behind its own flag).
 */
export async function sendOperatorEmail(input: { to: string; subject: string; html: string; kind: string; idempotencyKey?: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await sendEmail({ to: input.to, subject: input.subject, html: input.html, language: "pl", kind: input.kind, idempotencyKey: input.idempotencyKey });
  return res.ok ? { ok: true } : { ok: false, error: res.error.message };
}
