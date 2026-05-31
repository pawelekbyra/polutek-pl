import { getClerkClient } from '@/lib/clerk';
import { prisma } from '@/lib/prisma';

export class UserAccessService {
  /**
   * Recalculates and updates the user's isPatron status based on active grants.
   */
  static async recalculateUserPatronStatus(userId: string, tx?: any) {
    const db = tx || prisma;

    const activeGrant = await db.patronGrant.findFirst({
        where: {
            userId,
            revokedAt: null
        }
    });

    const isPatron = !!activeGrant;

    const user = await db.user.update({
        where: { id: userId },
        data: {
            isPatron,
            patronSince: isPatron ? (activeGrant.createdAt) : null
        }
    });

    // Sync to Clerk
    await this.syncClerkAccess(userId, isPatron, user.totalPaidMinor / 100);

    return isPatron;
  }

  /**
   * Synchronizes user's access status (Patron) and metadata to Clerk.
   * Clerk metadata is used for quick frontend checks, while DB is the source of truth.
   */
  static async syncClerkAccess(userId: string, isPatron: boolean, totalPaid?: number) {
    try {
      const client = await getClerkClient();
      const role = isPatron ? 'PATRON' : 'USER';

      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          role,
          isPatron,
          ...(totalPaid !== undefined ? { totalPaid } : {}),
        },
      });

      console.log(`[UserAccessService] Synced Clerk access for user ${userId}: isPatron=${isPatron}, role=${role}`);
    } catch (error) {
      console.error(`[UserAccessService] Error syncing Clerk access for user ${userId}:`, error);
      // We don't throw here to avoid failing the main operation if only Clerk sync fails
    }
  }
}
