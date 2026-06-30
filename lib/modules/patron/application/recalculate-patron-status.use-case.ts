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

  const user = await repo.findUserWithPaymentTotals(userId, db);
  if (!user) return failure(new UserNotFoundError(userId));

  const activeGrants = await repo.listActiveGrants(userId, db);
  const firstActiveGrant = activeGrants[0] ?? null;

  return success({
    userId: user.id,
    isPatron: activeGrants.length > 0,
    patronSince: firstActiveGrant?.createdAt ?? null,
    patronSource: firstActiveGrant?.source ?? null,
    activeGrants,
    normalizedTotal: normalizePaymentTotals(user.paymentTotals),
  });
}
