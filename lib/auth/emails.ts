import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  resolveEmailLanguage,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/modules/email";

type MailUser = { email: string; name?: string | null };

async function languageFor(email: string): Promise<"pl" | "en"> {
  try {
    const row = await prisma.user.findUnique({ where: { email }, select: { language: true } });
    return resolveEmailLanguage(row?.language);
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
