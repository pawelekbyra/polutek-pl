import { AppContext } from "@/lib/modules/shared/app-context";
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

  try {
    await ctx.db.writeTransaction(async (tx) => {
      const referredUser = await userRepo.findProfileById(referredUserId);
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

      await referralRepo.create({
        referrerId: referrer.id,
        referredId: referredUserId,
        status: 'CLAIMED',
        source: 'link',
        claimedAt: new Date(),
      }, tx);

      await userRepo.setReferredBy(referredUserId, referrer.id, tx);
      await userRepo.incrementReferralStats(referrer.id, tx);
    });

    return success({ success: true });
  } catch (error) {
    if (error instanceof ReferralError) {
      return failure(error);
    }
    throw error;
  }
}
