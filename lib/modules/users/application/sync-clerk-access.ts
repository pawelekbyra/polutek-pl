import { logger } from "@/lib/logger";
import { getClerkClient } from '@/lib/clerk';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { recordAuditEvent } from '@/lib/modules/audit';

type ClerkRole = 'USER' | 'ADMIN' | 'PATRON';

type ClerkPublicMetadata = {
  role: ClerkRole;
  isPatron: boolean;
  totalPaid?: number;
};

export async function syncClerkAccess(userId: string, isPatron: boolean, totalPaid?: number) {
  const role: ClerkRole = isPatron ? 'PATRON' : 'USER';
  const publicMetadata: ClerkPublicMetadata = {
    role,
    isPatron,
    ...(totalPaid !== undefined ? { totalPaid } : {}),
  };

  const retry = async (attempts = 3) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const client = await getClerkClient();
        await client.users.updateUserMetadata(userId, { publicMetadata });
        logger.info(`[syncClerkAccess] Synced Clerk access for user ${userId}: isPatron=${isPatron}, role=${role} (attempt ${i + 1})`);
        return true;
      } catch (error) {
        logger.error(`[syncClerkAccess] Error syncing Clerk access for user ${userId} (attempt ${i + 1}):`, error);
        if (i < attempts - 1) {
          const delay = 250 * Math.pow(3, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    return false;
  };

  const success = await retry();
  if (!success) {
    logger.error(`[syncClerkAccess] Final failure syncing Clerk access for user ${userId}`);
    const ctx = createAppContext({ type: 'system', reason: 'clerk_sync' });
    await recordAuditEvent(ctx, {
      action: "CLERK_SYNC_FAILED",
      targetType: "User",
      targetId: userId,
      metadata: {
        isPatron,
        totalPaid,
        role
      }
    });
  }
}
