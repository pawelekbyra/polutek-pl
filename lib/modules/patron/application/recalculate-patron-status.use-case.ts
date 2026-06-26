import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { PatronStatusDto } from "../domain/patron.dto";
import { UserNotFoundError } from "../domain/patron.errors";
import { PatronRepository } from "../infrastructure/patron.repository";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { WriteTx } from "@/lib/modules/shared/db";

export async function recalculatePatronStatus(
  userId: string,
  ctx: AppContext,
  tx?: WriteTx
): Promise<UseCaseResult<PatronStatusDto, UserNotFoundError>> {
  const repo = new PatronRepository();
  const db = tx || ctx.db.read;

  const activeGrant = await repo.findFirstActiveGrant(userId, db);
  const isPatron = !!activeGrant;

  const updateFn = async (currentTx: WriteTx) => {
    const updatedUser = await repo.updateUserPatronFields(
      userId,
      {
        isPatron,
        patronSince: isPatron ? activeGrant.createdAt : null,
        patronSource: isPatron ? activeGrant.source : null,
      },
      currentTx,
      { preserveExistingPatronSince: true }
    );

    const activeGrants = await repo.listActiveGrants(userId, currentTx);
    const firstActiveGrant = activeGrants[0] ?? null;

    return {
        userId: updatedUser.id,
        isPatron: activeGrants.length > 0,
        patronSince: firstActiveGrant?.createdAt ?? null,
        patronSource: firstActiveGrant?.source ?? null,
        activeGrants,
        normalizedTotal: normalizePaymentTotals(updatedUser.paymentTotals),
    };
  };

  try {
      const result = tx ? await updateFn(tx) : await ctx.db.writeTransaction(updateFn);
      return success(result);
  } catch (error) {
      const user = await repo.findUserWithPaymentTotals(userId, db);
      if (!user) return failure(new UserNotFoundError(userId));
      throw error;
  }
}
