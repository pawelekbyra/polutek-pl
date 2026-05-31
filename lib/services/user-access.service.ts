import { getClerkClient } from '@/lib/clerk';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type DbClient = typeof prisma | Prisma.TransactionClient;

type PaymentTotal = {
  currency: string;
  amountMinor: number;
};

type ClerkRole = 'USER' | 'ADMIN' | 'PATRON';

type ClerkPublicMetadata = {
  role: ClerkRole;
  isPatron: boolean;
  totalPaid?: number;
};

function normalizePaymentTotals(paymentTotals: PaymentTotal[]) {
  const totalPLN = paymentTotals.find((t) => t.currency === 'PLN')?.amountMinor || 0;
  const totalEUR = paymentTotals.find((t) => t.currency === 'EUR')?.amountMinor || 0;
  return (totalPLN / 100) + (totalEUR / 100 * 4.3);
}

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

    return { isPatron, normalizedTotal: normalizePaymentTotals(user.paymentTotals) };
  }

  /**
   * Synchronizes user's access status (Patron) and metadata to Clerk.
   * Clerk metadata is used for quick frontend checks, while DB is the source of truth.
   */
  static async syncClerkAccess(userId: string, isPatron: boolean, totalPaid?: number) {
    try {
      const client = await getClerkClient();
      const role: ClerkRole = isPatron ? 'PATRON' : 'USER';
      const publicMetadata: ClerkPublicMetadata = {
        role,
        isPatron,
        ...(totalPaid !== undefined ? { totalPaid } : {}),
      };

      await client.users.updateUserMetadata(userId, { publicMetadata });

      console.log(`[UserAccessService] Synced Clerk access for user ${userId}: isPatron=${isPatron}, role=${role}`);
    } catch (error) {
      console.error(`[UserAccessService] Error syncing Clerk access for user ${userId}:`, error);
    }
  }
}
