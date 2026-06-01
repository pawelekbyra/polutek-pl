import { getClerkClient } from '@/lib/clerk';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { writeAuditLog } from './audit.service';

type DbClient = typeof prisma | Prisma.TransactionClient;

type PaymentTotal = {
  currency: string;
  amountMinor: number;
};

type ClerkRole = 'USER' | 'ADMIN' | 'PATRON';

import { normalizePaymentTotalsToPln } from '../payments/payment-totals';

type ClerkPublicMetadata = {
  role: ClerkRole;
  isPatron: boolean;
  totalPaid?: number;
};

export class UserAccessService {
  /**
   * Recalculates and updates the user's isPatron status based on active grants.
   */
  static async recalculateUserPatronStatus(userId: string, tx?: DbClient) {
    const db = tx || prisma;

    const activeGrant = await db.patronGrant.findFirst({
        where: {
            userId,
            revokedAt: null
        },
        orderBy: { createdAt: 'asc' }
    });

    const isPatron = !!activeGrant;

    const user = await db.user.update({
        where: { id: userId },
        data: {
            isPatron,
            patronSince: isPatron ? (activeGrant.createdAt) : null
        },
        include: {
          paymentTotals: true
        }
    });

    return { isPatron, normalizedTotal: normalizePaymentTotalsToPln(user.paymentTotals) };
  }

  /**
   * Synchronizes user's access status (Patron) and metadata to Clerk.
   * Clerk metadata is used for quick frontend checks, while DB is the source of truth.
   */
  static async syncClerkAccess(userId: string, isPatron: boolean, totalPaid?: number) {
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
          console.log(`[UserAccessService] Synced Clerk access for user ${userId}: isPatron=${isPatron}, role=${role} (attempt ${i + 1})`);
          return true;
        } catch (error) {
          console.error(`[UserAccessService] Error syncing Clerk access for user ${userId} (attempt ${i + 1}):`, error);
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
      console.error(`[UserAccessService] Final failure syncing Clerk access for user ${userId}`);
      await writeAuditLog({
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
}
