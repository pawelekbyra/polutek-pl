import { logger } from "@/lib/logger";
import { escapeHtml } from "../domain/email-content";
import { sendEmail } from "../infrastructure/resend-email.transport";

const DEFAULT_RECIPIENT = "pawel.perfect@gmail.com";

/** NEW_USER_NOTIFY_EMAIL overrides the recipient; "off" (or "none") switches the notification off. */
export function newUserNotificationRecipient(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.NEW_USER_NOTIFY_EMAIL?.trim();
  if (!raw) return DEFAULT_RECIPIENT;
  if (["off", "none", "false", "0"].includes(raw.toLowerCase())) return null;
  return raw.includes("@") ? raw : DEFAULT_RECIPIENT;
}

export type NewUserNotice = { userId: string; email: string; nickname: string | null; language: string | null; createdAt: Date };

/** Builds the owner's notice (pure; every user-supplied value is escaped, the nickname is free text). */
export function buildNewUserNotice(user: NewUserNotice): { subject: string; html: string } {
  const nick = user.nickname?.trim() || "(bez nicku)";
  const row = (label: string, value: string) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${label}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`;
  return {
    subject: `Nowy użytkownik: ${nick.replace(/[\r\n]+/g, " ").slice(0, 60)}`,
    html:
      `<p>Ktoś właśnie założył konto na pawelperfect.com.</p>` +
      `<table>${row("Nick", nick)}${row("E-mail", user.email)}${row("Język", user.language || "—")}${row("Kiedy", user.createdAt.toISOString().replace("T", " ").slice(0, 16) + " UTC")}</table>` +
      `<p style="color:#666">Szczegóły i moderacja: panel administratora → Użytkownicy.</p>`,
  };
}

/**
 * Tells the owner a new account finished sign-up (called once, at the first-sign-in step that also sends the
 * welcome mail). Best effort: a failure is logged and never blocks the user.
 */
export async function notifyOwnerOfNewUser(user: NewUserNotice): Promise<void> {
  const to = newUserNotificationRecipient();
  if (!to) return;
  const { subject, html } = buildNewUserNotice(user);
  const result = await sendEmail({ to, subject, html, language: "pl", kind: "admin-new-user", idempotencyKey: `new-user-${user.userId}` });
  if (!result.ok) logger.error("[email] new-user notification failed", { name: result.error.name, statusCode: result.error.statusCode });
}
