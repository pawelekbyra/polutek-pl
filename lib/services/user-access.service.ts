import { getClerkClient } from '@/lib/clerk';

export class UserAccessService {
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
