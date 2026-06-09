import { AppContext } from "../../shared/app-context";
import { UseCaseResult, ok, fail } from "../../shared/result";
import { EmailError } from "../domain/email.errors";
import { EmailRepository } from "../infrastructure/email.repository";

/**
 * listInboundEmails use case.
 * Fetches the history of inbound responses.
 */
export async function listInboundEmails(
  ctx: AppContext
): Promise<UseCaseResult<unknown[], EmailError>> {
  try {
    const repository = new EmailRepository(ctx.prisma);
    const emails = await repository.listInboundEmails();

    return ok(emails);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch inbound emails";
    return fail(new EmailError(message));
  }
}
