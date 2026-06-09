import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";
import { InboundEmailStatus } from "@prisma/client";

/**
 * updateInboundEmailStatus use case.
 * Updates the status of an inbound response (e.g., READ, ARCHIVED).
 */
export async function updateInboundEmailStatus(
  ctx: AppContext,
  id: string,
  status: InboundEmailStatus
): Promise<UseCaseResult<unknown, EmailError>> {
  try {
    const repository = new EmailRepository(ctx.prisma);
    const updated = await repository.updateInboundEmailStatus(id, status);

    return ok(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update inbound email status";
    return fail(new EmailError(message));
  }
}
