import { resolveMainChannelId } from "@/lib/modules/channel";
import { DbClient } from "../../shared/db";

export type EligibleRecipient = {
  userId: string;
  email: string;
  name: string | null;
  language: "pl" | "en";
};

/**
 * Who may receive a broadcast: a live account that follows the channel (Subscription), has given
 * consent to content notifications (EmailPreference.marketingEmails, matched by user id so the case
 * of the address does not matter) and whose address is not blocked after a bounce or complaint
 * (EmailSuppression, compared case-insensitively). Three set queries, never one query per person.
 *
 * `onlyUserIds` re-checks a batch right before sending, so someone who unsubscribed after the
 * broadcast was created is skipped.
 */
export async function findEligibleRecipients(db: DbClient, onlyUserIds?: string[]): Promise<EligibleRecipient[]> {
  const mainChannelId = await resolveMainChannelId(db);
  if (!mainChannelId) return [];
  const creator = { id: mainChannelId };
  if (onlyUserIds && onlyUserIds.length === 0) return [];

  const users = await db.user.findMany({
    where: {
      isDeleted: false,
      subscriptions: { some: { creatorId: creator.id } },
      ...(onlyUserIds ? { id: { in: onlyUserIds } } : {}),
    },
    select: { id: true, email: true, name: true, language: true },
    orderBy: { createdAt: "asc" },
  });
  if (users.length === 0) return [];

  const consented = await db.emailPreference.findMany({
    where: { userId: { in: users.map((u) => u.id) }, marketingEmails: true },
    select: { userId: true },
  });
  const consentedIds = new Set(consented.map((p) => p.userId));

  const withConsent = users.filter((u) => consentedIds.has(u.id) && u.email && !u.email.startsWith("deleted_"));
  if (withConsent.length === 0) return [];

  const suppressed = await db.emailSuppression.findMany({
    where: { active: true, email: { in: withConsent.map((u) => u.email), mode: "insensitive" } },
    select: { email: true },
  });
  const suppressedEmails = new Set(suppressed.map((s) => s.email.toLowerCase()));

  return withConsent
    .filter((u) => !suppressedEmails.has(u.email.toLowerCase()))
    .map((u) => ({ userId: u.id, email: u.email, name: u.name, language: u.language === "pl" ? "pl" : "en" }));
}
