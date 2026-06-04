import { logger } from "@/lib/logger";
import { getClerkClient } from '@/lib/clerk';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { writeAuditLog } from './audit.service';
import { DISPLAY_EUR_TO_PLN_RATE, DISPLAY_USD_TO_PLN_RATE } from '../constants';

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

/**
 * Estimated lifetime total in PLN for display purposes.
 * Note: Access decisions should rely on User.isPatron, not this normalized sum.
 */
export function normalizePaymentTotals(paymentTotals: PaymentTotal[]) {
  const totalPLN = paymentTotals.find((t) => t.currency === 'PLN')?.amountMinor || 0;
  const totalEUR = paymentTotals.find((t) => t.currency === 'EUR')?.amountMinor || 0;
  const totalUSD = paymentTotals.find((t) => t.currency === 'USD')?.amountMinor || 0;

  // Using simple fixed rates for estimation; these are display-only and do not grant access.
  return (totalPLN / 100) +
         (totalEUR / 100 * DISPLAY_EUR_TO_PLN_RATE) +
         (totalUSD / 100 * DISPLAY_USD_TO_PLN_RATE);
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
            patronSince: isPatron ? activeGrant.createdAt : null,
            patronSource: isPatron ? activeGrant.source : null
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
          logger.info(`[UserAccessService] Synced Clerk access for user ${userId}: isPatron=${isPatron}, role=${role} (attempt ${i + 1})`);
          return true;
        } catch (error) {
          logger.error(`[UserAccessService] Error syncing Clerk access for user ${userId} (attempt ${i + 1}):`, error);
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
      logger.error(`[UserAccessService] Final failure syncing Clerk access for user ${userId}`);
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
