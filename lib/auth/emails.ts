import { getSessionCookie } from "better-auth/cookies";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  sendChangeEmailConfirmationEmail,
  sendChangeEmailVerificationEmail,
  sendEmailChangedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/modules/email";
import { recordAuthAudit } from "./audit";
import { SESSION_COOKIE_PREFIX } from "./config";

type MailUser = { id?: string | null; email: string; name?: string | null; language?: string | null };
type Language = "pl" | "en";

/**
 * The account's language. During an e-mail change Better Auth hands us the user with the NEW address,
 * which is not in the database yet, so the id is tried before the address (audit F-15/AUTH-21).
 */
async function languageFor(user: MailUser): Promise<Language> {
  if (user.language === "pl" || user.language === "en") return user.language;
  try {
    const row = user.id
      ? await prisma.user.findUnique({ where: { id: user.id }, select: { language: true } })
      : await prisma.user.findUnique({ where: { email: user.email }, select: { language: true } });
    return row?.language === "pl" ? "pl" : "en";
  } catch {
    return "en";
  }
}

/**
 * Better Auth asks for e-mails inside the request. They are fired without awaiting (the response
 * must not reveal, through timing, whether an account exists) and failures are only logged.
 */
function fire(label: string, task: () => Promise<unknown>) {
  void task().catch((error) => {
    logger.error(`[auth-email] ${label} failed`, error instanceof Error ? error.message : String(error));
  });
}

type EmailTokenPayload = { email?: string; updateTo?: string; requestType?: string };

/**
 * Reads the claims of a Better Auth e-mail link (`/verify-email?token=<JWT>`) WITHOUT checking the
 * signature. Only used to pick the right wording/recipient for links Better Auth itself just created
 * or has just verified; never as proof of anything.
 */
export function readEmailTokenClaims(urlOrRequestUrl: string | null | undefined): EmailTokenPayload | null {
  if (!urlOrRequestUrl) return null;
  try {
    const token = new URL(urlOrRequestUrl, "https://placeholder.invalid").searchParams.get("token");
    const part = token?.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as EmailTokenPayload;
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

/** Sign-up verification, or (during an e-mail change) confirmation of the NEW address. */
export function queueVerificationEmail(user: MailUser, url: string) {
  const isChange = readEmailTokenClaims(url)?.requestType === "change-email-verification";
  fire(isChange ? "change e-mail verification" : "verification", async () => {
    const language = await languageFor(user);
    return isChange
      ? sendChangeEmailVerificationEmail(user.email, url, language)
      : sendVerificationEmail(user.email, url, language);
  });
}

/** Step 1 of an e-mail change: the CURRENT address must approve it (audit AUTH-02). */
export function queueChangeEmailConfirmation(user: MailUser, newEmail: string, url: string) {
  fire("change e-mail confirmation", async () =>
    sendChangeEmailConfirmationEmail(user.email, newEmail, url, await languageFor(user)),
  );
}

/**
 * After an e-mail change every other device is signed out, as after a password change. The session
 * kept is the one this browser gets: Better Auth sets it right after this hook, either the session
 * the browser already had (its cookie) or, without one, the session it has just created (the newest).
 */
async function revokeOtherSessionsAfterEmailChange(userId: string, request?: Request | null) {
  const cookieToken = request ? getSessionCookie(request, { cookiePrefix: SESSION_COOKIE_PREFIX })?.split(".")[0] : undefined;
  const sessions = await prisma.session.findMany({
    where: { userId },
    select: { id: true, token: true },
    orderBy: { createdAt: "desc" },
  });
  const keep = sessions.find((session) => session.token === cookieToken) ?? sessions[0];
  if (!keep) return;
  await prisma.session.deleteMany({ where: { userId, id: { not: keep.id } } });
}

/**
 * `emailVerification.afterEmailVerification`: after the new address was confirmed, the old address
 * gets a notice (the approval link may have been clicked by someone else who reads that inbox), other
 * devices are signed out and the change is audited. Plain sign-up verifications are left alone.
 */
export async function onEmailVerified(user: MailUser, request?: Request | null) {
  const claims = readEmailTokenClaims(request?.url);
  if (claims?.requestType !== "change-email-verification" || !claims.email || !claims.updateTo) return;
  const oldEmail = claims.email;
  fire("e-mail changed notice", async () => sendEmailChangedEmail(oldEmail, claims.updateTo!, await languageFor(user)));
  if (user.id) {
    try {
      await revokeOtherSessionsAfterEmailChange(user.id, request);
    } catch (error) {
      logger.error("[auth] could not sign other devices out after an e-mail change", error instanceof Error ? error.message : String(error));
    }
  }
  await recordAuthAudit({ action: "AUTH_EMAIL_CHANGED", userId: user.id ?? null });
}

export function queuePasswordResetEmail(user: MailUser, url: string) {
  fire("password reset", async () => sendPasswordResetEmail(user.email, url, await languageFor(user)));
}

export function queuePasswordChangedEmail(user: MailUser) {
  fire("password changed", async () => sendPasswordChangedEmail(user.email, await languageFor(user)));
}
