import { prisma } from "@/lib/prisma";

/** How long a password sign-up may stay unverified before the row is dropped (frees the address and nickname). */
export const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 7;

/**
 * Deletes password or passkey sign-ups whose e-mail was never verified for N days (F-04). Such a row can never
 * sign in (`requireEmailVerification`), so nothing of value hangs on it; leaving it would let
 * anyone squat an e-mail address or a nickname by registering and never clicking the link.
 *
 * Only rows with no payments, supporter grants, channels or comments are touched, and only plain
 * users (never an admin). Session/Account/2FA/Passkey/avatar/notification rows go with the user (ON DELETE CASCADE).
 */
export async function pruneUnverifiedAccounts(options: { now?: Date; olderThanDays?: number } = {}) {
  const now = options.now ?? new Date();
  const days = options.olderThanDays ?? UNVERIFIED_ACCOUNT_RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.user.deleteMany({
    where: {
      emailVerified: false,
      isDeleted: false,
      role: "USER",
      createdAt: { lt: cutoff },
      stripeCustomerId: null,
      payments: { none: {} },
      patronGrants: { none: {} },
      creators: { none: {} },
      comments: { none: {} },
    },
  });
  return { deletedCount: result.count, cutoff: cutoff.toISOString() };
}
