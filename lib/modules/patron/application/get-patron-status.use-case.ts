import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { PatronStatusDto } from "../domain/patron.dto";
import { UserNotFoundError } from "../domain/patron.errors";
import { PatronRepository } from "../infrastructure/patron.repository";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { buildPatronStatusDto } from "../domain/patron-read-model";

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

  return success(buildPatronStatusDto({
    userId: user.id,
    activeGrants,
    normalizedTotal: normalizePaymentTotals(user.paymentTotals),
  }));
}
