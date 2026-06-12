import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { PatronStatusDto } from "../domain/patron.dto";
import { UserNotFoundError } from "../domain/patron.errors";
import { PatronRepository } from "../infrastructure/patron.repository";
import { normalizePaymentTotals } from "@/lib/modules/users";

export async function getPatronStatus(
  userId: string,
  ctx: AppContext
): Promise<UseCaseResult<PatronStatusDto, UserNotFoundError>> {
  const repo = new PatronRepository();
  const user = await repo.findUserWithPaymentTotals(userId, ctx.db.read);

  if (!user) {
    return failure(new UserNotFoundError(userId));
  }

  const activeGrants = await repo.listActiveGrants(userId, ctx.db.read);
  const primaryGrant = activeGrants[0] ?? null;

  return success({
    userId: user.id,
    isPatron: primaryGrant !== null,
    patronSince: primaryGrant?.createdAt ?? null,
    patronSource: primaryGrant?.source ?? null,
    activeGrants,
    normalizedTotal: normalizePaymentTotals(user.paymentTotals),
  });
}
