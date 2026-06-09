import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { RevokePatronInput, PatronStatusDto } from "../domain/patron.dto";
import { PatronPolicy } from "../domain/patron.policy";
import { InvalidPatronActionError, UserNotFoundError } from "../domain/patron.errors";
import { PatronRepository } from "../infrastructure/patron.repository";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { recordAuditEvent } from "@/lib/modules/audit";

export async function revokePatron(
  input: RevokePatronInput,
  ctx: AppContext
): Promise<UseCaseResult<PatronStatusDto, InvalidPatronActionError | UserNotFoundError>> {
  if (!PatronPolicy.canRevokePatron(ctx.actor)) {
    return failure(new InvalidPatronActionError("Actor not authorized to revoke patron status."));
  }

  const repo = new PatronRepository();

  return await ctx.db.writeTransaction(async (tx) => {
    const user = await repo.findUserWithPaymentTotals(input.userId, tx);
    if (!user) return failure(new UserNotFoundError(input.userId));

    await repo.revokeActiveGrants(input.userId, input.note || 'Patron status revoked', tx);

    const updatedUser = await repo.updateUserPatronFields(input.userId, {
      isPatron: false,
      patronSince: null,
      patronSource: null,
    }, tx);

    await recordAuditEvent(ctx, {
      action: 'PATRON_REVOKED',
      targetType: 'User',
      targetId: input.userId,
      metadata: { note: input.note },
    }, tx);

    return success({
      userId: updatedUser.id,
      isPatron: updatedUser.isPatron,
      patronSince: updatedUser.patronSince,
      patronSource: updatedUser.patronSource,
      activeGrants: [],
      normalizedTotal: normalizePaymentTotals(updatedUser.paymentTotals),
    });
  });
}
