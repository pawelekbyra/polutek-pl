import { AppContext, createAppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { UserRepository } from "../infrastructure/user.repository";
import { ReferralRepository } from "../infrastructure/referral.repository";
import {
  SelfReferralError,
  UserAlreadyReferredError,
  ReferredUserNotFoundError,
  InvalidReferralCodeError,
  ReferralError
} from "../domain/referral.errors";
import { grantPatron } from "@/lib/modules/patron";
import { UserAccessService } from "@/lib/services/user-access.service";
import { logger } from "@/lib/logger";

export interface ClaimReferralInput {
  referralCode: string;
  referredUserId: string;
}

export async function claimReferral(
  ctx: AppContext,
  input: ClaimReferralInput
): Promise<UseCaseResult<{ success: true }, ReferralError>> {
  const { referralCode, referredUserId } = input;

  const userRepo = new UserRepository(ctx.prisma);
  const referralRepo = new ReferralRepository(ctx.prisma);

  const referrer = await userRepo.findByReferralCodeOrId(referralCode);
  if (!referrer) {
    return failure(new InvalidReferralCodeError());
  }

  if (referrer.id === referredUserId) {
    return failure(new SelfReferralError());
  }

  const syncData: { current: { userId: string; isPatron: boolean; totalPaid: number } | null } = { current: null };

  try {
    await ctx.db.writeTransaction(async (tx) => {
      const referredUser = await userRepo.findProfileById(referredUserId, tx);
      if (!referredUser) {
        throw new ReferredUserNotFoundError();
      }

      if (referredUser.referredById) {
        throw new UserAlreadyReferredError();
      }

      const existingReferral = await referralRepo.findByReferredId(referredUserId, tx);
      if (existingReferral) {
        throw new UserAlreadyReferredError();
      }

      const referral = await referralRepo.create({
        referrerId: referrer.id,
        referredId: referredUserId,
        status: 'CLAIMED',
        source: 'link',
        claimedAt: new Date(),
      }, tx);

      await userRepo.setReferredBy(referredUserId, referrer.id, tx);
      await userRepo.incrementReferralStats(referrer.id, tx);

      const freshReferrer = await userRepo.findProfileById(referrer.id, tx);

      if (freshReferrer && freshReferrer.referralPoints >= 5) {
        // Referral rewards grant Patron through a system actor context to bypass user-level restrictions
        const rewardCtx = createAppContext({
            actor: { type: 'system', reason: 'referral_reward' },
            requestId: ctx.requestId,
            prisma: ctx.prisma,
            now: ctx.now
        });

        const patronResult = await grantPatron({
          userId: referrer.id,
          source: 'referral',
          referralId: referral.id,
          note: 'Granted by referral reward',
        }, rewardCtx, tx);

        if (patronResult.ok) {
          syncData.current = {
            userId: referrer.id,
            isPatron: patronResult.data.isPatron,
            totalPaid: patronResult.data.normalizedTotal
          };
        } else {
            logger.error(`[ClaimReferralUseCase] Failed to grant patron reward for referrer ${referrer.id}:`, patronResult.error);
        }
      }
    });

    if (syncData.current) {
      await UserAccessService.syncClerkAccess(
        syncData.current.userId,
        syncData.current.isPatron,
        syncData.current.totalPaid
      ).catch(err => {
        logger.error("[ClaimReferralUseCase] Clerk sync failed after transaction:", err);
      });
    }

    return success({ success: true });
  } catch (error) {
    if (error instanceof ReferralError) {
      return failure(error);
    }
    throw error;
  }
}
