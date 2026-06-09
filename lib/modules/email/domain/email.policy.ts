import { DbClient } from "../../shared/db";

export class EmailPolicy {
  /**
   * Determines if a recipient can receive marketing/broadcast emails.
   * R9 boundary: only checks email preferences, not patron access.
   */
  static async canReceiveBroadcastEmail(
    prisma: DbClient,
    email: string
  ): Promise<boolean> {
    const preference = await prisma.emailPreference.findUnique({
      where: { email },
      select: { marketingEmails: true }
    });

    // Default to true if no preference record exists (opt-in by default)
    return preference?.marketingEmails ?? true;
  }
}
