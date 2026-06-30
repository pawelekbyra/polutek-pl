import { DbClient } from "../../shared/db";
import { flags } from "@/lib/feature-flags";

export class EmailPolicy {
  /**
   * Checks if an email address is globally suppressed due to bounce or complaint.
   */
  static async isSuppressed(prisma: DbClient, email: string): Promise<boolean> {
    const suppression = await prisma.emailSuppression.findUnique({
      where: { email },
    });
    return suppression?.active === true;
  }

  /**
   * Determines if a recipient can receive content/broadcast notifications.
   * Content notifications require both an active local Subscription and
   * explicit EmailPreference.marketingEmails consent.
   *
   * Suppression overrides any existing consent or subscription.
   */
  static async canReceiveBroadcastEmail(
    prisma: DbClient,
    email: string,
    userId?: string | null
  ): Promise<boolean> {
    // 1. Suppression check (Highest priority)
    const suppressed = await this.isSuppressed(prisma, email);
    if (suppressed) return false;

    if (!userId) return false;

    const mainCreatorSlug = flags.mainCreatorSlug;
    if (!mainCreatorSlug) return false;

    const mainCreator = await prisma.creator.findUnique({
      where: { slug: mainCreatorSlug },
      select: { id: true },
    });
    if (!mainCreator) return false;

    const subscription = await prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: mainCreator.id } },
      select: { id: true },
    });
    if (!subscription) return false;

    const preference = await prisma.emailPreference.findUnique({
      where: { email },
      select: { marketingEmails: true },
    });

    return preference?.marketingEmails === true;
  }
}
