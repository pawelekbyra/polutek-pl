import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { InboundEmailDto, UpdateInboundEmailInput } from "../domain/email.dto";
import { recordAuditEvent } from "@/lib/modules/audit";

/**
 * updateInboundEmail use case.
 * R9: encapsulated update of inbound email status.
 */
export async function updateInboundEmail(
  ctx: AppContext,
  input: UpdateInboundEmailInput
): Promise<UseCaseResult<InboundEmailDto, EmailError>> {
  const { id, status } = input;

  if (!id || !status) {
      return fail(new EmailError("Missing id or status", 400));
  }

  try {
    const updated = await ctx.db.writeTransaction(async (tx) => {
      const row = await tx.inboundEmail.update({
        where: { id },
        data: { status }
      });
      await recordAuditEvent(ctx, {
        action: "INBOUND_EMAIL_UPDATED",
        targetType: "InboundEmail",
        targetId: id,
        metadata: { status },
      }, tx);
      return row;
    });

    return ok(updated as InboundEmailDto);
  } catch (error: any) {
    if (error.code === 'P2025') {
        return fail(new EmailError(`Inbound email with id ${id} not found`, 404, 'INBOUND_EMAIL_NOT_FOUND'));
    }
    return fail(new EmailError(error.message || "Failed to update inbound email"));
  }
}
