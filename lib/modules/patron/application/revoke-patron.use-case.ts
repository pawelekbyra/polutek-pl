import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { RevokePatronInput, PatronStatusDto } from "../domain/patron.dto";
import { PatronPolicy } from "../domain/patron.policy";
import { InvalidPatronActionError, UserNotFoundError } from "../domain/patron.errors";
import { PatronRepository } from "../infrastructure/patron.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { WriteTx } from "@/lib/modules/shared/db";
import { recalculatePatronStatus } from "./recalculate-patron-status.use-case";

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

    const note = input.note || 'Patron status revoked';
    // Only a human admin is recorded as the revoker; system actors (webhooks) stay null.
    const meta = {
      revokedById: ctx.actor.type === 'admin' ? ctx.actor.userId : null,
      revokeReason: input.reason ?? input.note ?? null,
    };

    if (input.paymentId) {
      await repo.revokeGrantByPaymentId(input.paymentId, note, currentTx, meta);
    } else {
      await repo.revokeActiveGrants(input.userId, note, currentTx, meta);
    }

    const recalcResult = await recalculatePatronStatus(input.userId, ctx, currentTx);
    if (!recalcResult.ok) {
      throw new Error(`RECALC_FAILED: ${recalcResult.error.message}`);
    }

    await recordAuditEvent(ctx, {
      action: 'PATRON_REVOKED',
      targetType: 'User',
      targetId: input.userId,
      metadata: {
        note: input.note,
        reason: input.reason,
        paymentId: input.paymentId,
        targeted: !!input.paymentId
      },
    }, currentTx);

    return success(recalcResult.data);
  };

  return tx ? await work(tx) : await ctx.db.writeTransaction(work);
}
