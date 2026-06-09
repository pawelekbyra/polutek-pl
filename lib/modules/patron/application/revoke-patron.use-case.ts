import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { RevokePatronInput, PatronStatusDto } from "../domain/patron.dto";
import { PatronPolicy } from "../domain/patron.policy";
import { InvalidPatronActionError, UserNotFoundError } from "../domain/patron.errors";
import { PatronRepository } from "../infrastructure/patron.repository";
import { normalizePaymentTotals } from "@/lib/modules/users";
import { recordAuditEvent } from "@/lib/modules/audit";
import { WriteTx } from "@/lib/modules/shared/db";

export async function revokePatron(
  input: RevokePatronInput,
  ctx: AppContext,
  tx?: WriteTx
): Promise<UseCaseResult<PatronStatusDto, InvalidPatronActionError | UserNotFoundError>> {
  if (!PatronPolicy.canRevokePatron(ctx.actor)) {
    return failure(new InvalidPatronActionError("Actor not authorized to revoke patron status."));
  }

  const repo = new PatronRepository();

  const work = async (currentTx: WriteTx) => {
    const user = await repo.findUserWithPaymentTotals(input.userId, currentTx);
    if (!user) return failure(new UserNotFoundError(input.userId));

    await repo.revokeActiveGrants(input.userId, input.note || 'Patron status revoked', currentTx);

    const updatedUser = await repo.updateUserPatronFields(input.userId, {
      isPatron: false,
      patronSince: null,
      patronSource: null,
    }, currentTx);

    await recordAuditEvent(ctx, {
      action: 'PATRON_REVOKED',
      targetType: 'User',
      targetId: input.userId,
      metadata: { note: input.note },
    }, currentTx);

    return success({
      userId: updatedUser.id,
      isPatron: updatedUser.isPatron,
      patronSince: updatedUser.patronSince,
      patronSource: updatedUser.patronSource,
      activeGrants: [],
      normalizedTotal: normalizePaymentTotals(updatedUser.paymentTotals),
    });
  };

  return tx ? await work(tx) : await ctx.db.writeTransaction(work);
}
