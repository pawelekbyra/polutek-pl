import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  sendAccountExistsEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "@/lib/modules/email";
import { getAuthBaseUrl } from "./config";

type MailUser = { email: string; name?: string | null };

async function languageFor(email: string): Promise<"pl" | "en"> {
  try {
    const row = await prisma.user.findUnique({ where: { email }, select: { language: true } });
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

export function queueVerificationEmail(user: MailUser, url: string) {
  fire("verification", async () => sendVerificationEmail(user.email, url, await languageFor(user.email)));
}

export function queuePasswordResetEmail(user: MailUser, url: string) {
  fire("password reset", async () => sendPasswordResetEmail(user.email, url, await languageFor(user.email)));
}

export function queuePasswordChangedEmail(user: MailUser) {
  fire("password changed", async () => sendPasswordChangedEmail(user.email, await languageFor(user.email)));
}

/** Sent to the owner of an address when somebody tries to sign up with it again. */
export function queueAccountExistsEmail(user: MailUser) {
  fire("account exists", async () =>
    sendAccountExistsEmail(user.email, `${getAuthBaseUrl()}/`, await languageFor(user.email)),
  );
}

export function queueWelcomeEmail(user: MailUser & { language?: string | null }) {
  fire("welcome", async () =>
    sendWelcomeEmail(user.email, user.name || undefined, user.language === "pl" ? "pl" : "en"),
  );
}
