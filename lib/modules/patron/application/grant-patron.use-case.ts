import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { PatronGrantSource } from "@prisma/client";
import { GrantPatronInput, PatronStatusDto } from "../domain/patron.dto";
import { PatronPolicy } from "../domain/patron.policy";
import { InvalidPatronActionError, UserNotFoundError } from "../domain/patron.errors";
import { PatronRepository } from "../infrastructure/patron.repository";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { Prisma } from "@prisma/client";
import { WriteTx } from "@/lib/modules/shared/db";

const SOURCE_MAP: Record<string, PatronGrantSource> = {
  stripe_tip: PatronGrantSource.STRIPE_TIP,
  referral: PatronGrantSource.REFERRAL,
  admin: PatronGrantSource.ADMIN,
  migration: PatronGrantSource.MIGRATION,
};

export async function grantPatron(
  input: GrantPatronInput,
  ctx: AppContext,
  tx?: WriteTx
): Promise<UseCaseResult<PatronStatusDto, InvalidPatronActionError | UserNotFoundError>> {
  if (!PatronPolicy.canGrantPatron(ctx.actor)) {
    return failure(new InvalidPatronActionError("Actor not authorized to grant patron status."));
  }

  const repo = new PatronRepository();
  const source = SOURCE_MAP[input.source];

  const work = async (currentTx: WriteTx) => {
    // 0. Idempotency check for admin (manual) grants
    if (source === PatronGrantSource.ADMIN) {
      const existingActiveAdminGrant = await repo.findActiveGrantByAdmin(input.userId, currentTx);
      if (existingActiveAdminGrant) {
        const user = await repo.findUserWithPaymentTotals(input.userId, currentTx);
        if (!user) return failure(new UserNotFoundError(input.userId));

        const activeGrants = await repo.listActiveGrants(input.userId, currentTx);

        return success({
          userId: user.id,
          isPatron: user.isPatron,
          patronSince: user.patronSince,
          patronSource: user.patronSource,
          activeGrants,
          normalizedTotal: normalizePaymentTotals(user.paymentTotals),
        });
      }
    }

    // 1. Idempotency check for paymentId
    if (input.paymentId) {
      const existingGrant = await repo.findGrantByPaymentId(input.paymentId, currentTx);
      if (existingGrant) {
        const user = await repo.findUserWithPaymentTotals(input.userId, currentTx);
        if (!user) return failure(new UserNotFoundError(input.userId));

        const activeGrants = await repo.listActiveGrants(input.userId, currentTx);

        return success({
          userId: user.id,
          isPatron: user.isPatron,
          patronSince: user.patronSince,
          patronSource: user.patronSource,
          activeGrants,
          normalizedTotal: normalizePaymentTotals(user.paymentTotals),
        });
      }
    }

    // 2. Idempotency check for referralId
    if (input.referralId) {
      const existingGrant = await repo.findGrantByReferralId(input.referralId, currentTx);
      if (existingGrant) {
        const user = await repo.findUserWithPaymentTotals(input.userId, currentTx);
        if (!user) return failure(new UserNotFoundError(input.userId));

        const activeGrants = await repo.listActiveGrants(input.userId, currentTx);

        return success({
          userId: user.id,
          isPatron: user.isPatron,
          patronSince: user.patronSince,
          patronSource: user.patronSource,
          activeGrants,
          normalizedTotal: normalizePaymentTotals(user.paymentTotals),
        });
      }
    }

    // 3. Fetch user and update status
    const user = await repo.findUserWithPaymentTotals(input.userId, currentTx);
    if (!user) return failure(new UserNotFoundError(input.userId));

    const now = new Date();
    const updatedUser = await repo.updateUserPatronFields(input.userId, {
      isPatron: true,
      patronSince: PatronPolicy.shouldPreservePatronSince(user.isPatron, user.patronSince) ? user.patronSince : now,
      patronSource: source,
    }, currentTx);

    // 4. Create grant record
    await repo.createGrant({
      userId: input.userId,
      source,
      paymentId: input.paymentId,
      referralId: input.referralId,
      grantedById: input.grantedByUserId,
      reason: input.note,
    }, currentTx);

    const activeGrants = await repo.listActiveGrants(input.userId, currentTx);

    return success({
      userId: updatedUser.id,
      isPatron: updatedUser.isPatron,
      patronSince: updatedUser.patronSince,
      patronSource: updatedUser.patronSource,
      activeGrants,
      normalizedTotal: normalizePaymentTotals(updatedUser.paymentTotals),
    });
  };

  try {
    return tx ? await work(tx) : await ctx.db.writeTransaction(work);
  } catch (error) {
      // Handle Race Condition (P2002: Unique constraint failed)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          const paymentIdMatch = input.paymentId && target.includes('paymentId');
          const referralIdMatch = input.referralId && target.includes('referralId');

          if (paymentIdMatch || referralIdMatch) {
              const db = tx || ctx.db.read;
              const existingGrant = await repo.findGrantByPaymentId(input.paymentId!, db) || await repo.findGrantByReferralId(input.referralId!, db);
              if (existingGrant) {
                  const user = await repo.findUserWithPaymentTotals(input.userId, db);
                  if (!user) return failure(new UserNotFoundError(input.userId));
                  const activeGrants = await repo.listActiveGrants(input.userId, db);
                  return success({
                      userId: user.id,
                      isPatron: user.isPatron,
                      patronSince: user.patronSince,
                      patronSource: user.patronSource,
                      activeGrants,
                      normalizedTotal: normalizePaymentTotals(user.paymentTotals),
                  });
              }
          }
      }
      throw error;
  }
}
