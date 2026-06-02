import { prisma } from '@/lib/prisma';
import { PatronGrantSource } from '@prisma/client';
import { UserAccessService } from './user-access.service';

type ClerkSyncData = {
  userId: string;
  isPatron: boolean;
  totalPaid: number;
} | null;

export class ReferralService {
  static async claimReferral(referrerId: string, referredId: string) {
    if (referrerId === referredId) {
      throw new Error("Self-referral is not allowed");
    }

    const syncData: { current: ClerkSyncData } = { current: null };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Check if already referred
        const existing = await tx.user.findUnique({
            where: { id: referredId },
            select: { referredById: true }
        });

        if (!existing) {
            throw new Error("Referred user not found");
        }

        if (existing.referredById) {
            throw new Error("User already referred");
        }

        const existingReferral = await tx.referral.findUnique({
            where: { referredId }
        });

        if (existingReferral) {
            throw new Error("User already referred");
        }

        const referral = await tx.referral.create({
            data: {
                referrerId,
                referredId,
                status: 'CLAIMED',
                source: 'link',
                claimedAt: new Date()
            }
        });

        // Update referred user
        await tx.user.update({
            where: { id: referredId },
            data: { referredById: referrerId }
        });

        // Increment referrer points
        const referrer = await tx.user.update({
            where: { id: referrerId },
            data: {
                referralPoints: { increment: 1 },
                referralCount: { increment: 1 }
            }
        });

        // Grant Patron if threshold reached (5 points)
        if (referrer.referralPoints >= 5 && !referrer.isPatron) {
            const updatedReferrer = await tx.user.update({
                where: { id: referrerId },
                data: {
                    isPatron: true,
                    patronSince: new Date()
                }
            });

            await tx.patronGrant.create({
                data: {
                    userId: referrerId,
                    source: PatronGrantSource.REFERRAL,
                    referralId: referral.id,
                    reason: 'Referral goal reached (5)'
                }
            });

            syncData.current = {
                userId: referrerId,
                isPatron: true,
                totalPaid: 0
            };
        }

        return { success: true };
      });

      // Sync to Clerk outside transaction
      const dataToSync = syncData.current;
      if (dataToSync) {
          await UserAccessService.syncClerkAccess(
              dataToSync.userId,
              dataToSync.isPatron,
              dataToSync.totalPaid
          ).catch(err => {
              console.error("[ReferralService] Clerk sync failed after transaction:", err);
          });
      }

      return result;
    } catch (error) {
      console.error("[REFERRAL_CLAIM_ERROR]", error);
      throw error;
    }
  }
}
